"use server";

import { revalidatePath } from "next/cache";
import { richiediAdmin } from "@/lib/auth";
import { aggiungiGiorni, oggiRoma } from "@/lib/date";
import { leggi, valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { registraOperazione } from "@/lib/registro";
import { periodoMeseSuccessivo } from "@/lib/sconti-privati";
import { creaClientServer } from "@/lib/supabase/server";

function aggiorna() {
  revalidatePath("/admin/sconti-privati");
  revalidatePath("/negozio", "layout");
}

export async function creaScontoPrivati(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const valori = valoriModulo(fd);
  const errori: Record<string, string> = {};
  const ambito = leggi(fd, "ambito");
  const sconto = Number(leggi(fd, "sconto_percentuale").replace(",", "."));
  const dati = {
    ambito,
    linea_id: ambito === "linea" ? leggi(fd, "linea_id") || null : null,
    prodotto_codice: ambito === "prodotto" ? leggi(fd, "prodotto_codice") || null : null,
    sconto_percentuale: sconto,
    inizio: leggi(fd, "inizio"),
    fine: leggi(fd, "fine"),
    creato_da: utente.id,
  };
  if (!["catalogo", "linea", "prodotto"].includes(ambito)) errori.ambito = "Scegli a cosa si applica";
  if (ambito === "linea" && !dati.linea_id) errori.linea_id = "Scegli la linea";
  if (ambito === "prodotto" && !dati.prodotto_codice) errori.prodotto_codice = "Scegli il prodotto";
  if (!(sconto > 0 && sconto <= 100)) errori.sconto_percentuale = "Sconto tra 0 e 100%";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dati.inizio)) errori.inizio = "Data di inizio";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dati.fine) || dati.fine < dati.inizio) errori.fine = "La fine deve essere dopo l'inizio";
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlla i campi evidenziati." };

  const db = await creaClientServer();
  const { data, error } = await db.from("sconti_privati").insert(dati).select("id").single();
  if (error) return { valori, messaggio: "Salvataggio non riuscito. Riprova." };
  await registraOperazione(db, utente.id, { azione: "crea_sconto_privati", entita: "sconti_privati", entitaId: data.id, dopo: dati });
  aggiorna();
  return { ok: true, messaggio: "Sconto salvato: i clienti lo vedono nel negozio nel periodo indicato." };
}

/** "Copia sul mese successivo": stesso sconto, periodo del mese dopo. */
export async function copiaMeseSuccessivo(ids: string[]): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const db = await creaClientServer();
  const { data: sconti } = await db.from("sconti_privati").select("*").in("id", ids);
  if (!sconti?.length) return { messaggio: "Nessuno sconto da copiare." };
  const copie = sconti.map((s) => ({
    ambito: s.ambito, linea_id: s.linea_id, prodotto_codice: s.prodotto_codice, sconto_percentuale: s.sconto_percentuale,
    ...periodoMeseSuccessivo(s), copiato_da: s.id, creato_da: utente.id,
  }));
  const { error } = await db.from("sconti_privati").insert(copie);
  if (error) return { messaggio: "Copia non riuscita. Riprova." };
  await registraOperazione(db, utente.id, { azione: "copia_sconti_privati", entita: "sconti_privati", dopo: { da: ids, copie: copie.length } });
  aggiorna();
  return { ok: true, messaggio: copie.length === 1 ? "Sconto copiato sul mese successivo." : `${copie.length} sconti copiati sul mese successivo.` };
}

/** Uno sconto non ancora iniziato si elimina; uno in corso si chiude a ieri (resta nello storico). */
export async function terminaSconto(id: string): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const db = await creaClientServer();
  const oggi = oggiRoma();
  const { data: s } = await db.from("sconti_privati").select("*").eq("id", id).single();
  if (!s) return { messaggio: "Sconto non trovato." };
  if (s.inizio > oggi) await db.from("sconti_privati").delete().eq("id", id);
  else await db.from("sconti_privati").update({ fine: aggiungiGiorni(oggi, -1) }).eq("id", id);
  await registraOperazione(db, utente.id, { azione: "termina_sconto_privati", entita: "sconti_privati", entitaId: id, prima: s });
  aggiorna();
  return { ok: true, messaggio: s.inizio > oggi ? "Sconto eliminato." : "Sconto terminato." };
}
