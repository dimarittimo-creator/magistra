"use server";

import { revalidatePath } from "next/cache";
import { richiediAdmin } from "@/lib/auth";
import { leggi, valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { registraOperazione } from "@/lib/registro";
import { creaClientServer } from "@/lib/supabase/server";

const euro = (t: string) => (t ? Math.round(Number(t.replace(",", ".")) * 100) : null);

export async function salvaSpeseEregole(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const valori = valoriModulo(fd);
  const errori: Record<string, string> = {};
  const importo = euro(leggi(fd, "importo"));
  const soglia = euro(leggi(fd, "soglia_gratuita"));
  const iva = Number(leggi(fd, "iva").replace(",", ".") || "22");
  const mesi = Number(leggi(fd, "mesi_minimi_lotto_privati"));
  if (importo != null && (!Number.isFinite(importo) || importo < 0)) errori.importo = "Importo non valido";
  if (soglia != null && (!Number.isFinite(soglia) || soglia <= 0)) errori.soglia_gratuita = "Importo non valido";
  if (!Number.isFinite(iva) || iva < 0 || iva > 100) errori.iva = "Aliquota non valida";
  if (!Number.isInteger(mesi) || mesi < 0 || mesi > 36) errori.mesi_minimi_lotto_privati = "Numero di mesi tra 0 e 36";
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlla i campi evidenziati." };

  const db = await creaClientServer();
  const dati = { importo_cent: importo, soglia_gratuita_cent: soglia, iva, attiva: true };
  const { error } = await db.from("spese_spedizione").update(dati).eq("canale", "privati");
  const { error: e2 } = await db.from("impostazioni").update({ mesi_minimi_lotto_privati: mesi }).eq("id", true);
  if (error || e2) return { valori, messaggio: "Salvataggio non riuscito. Riprova." };
  await registraOperazione(db, utente.id, { azione: "modifica_spese_privati", entita: "impostazioni", dopo: { ...dati, mesi_minimi_lotto_privati: mesi } });
  revalidatePath("/", "layout");
  return { ok: true, valori, messaggio: "Salvato." };
}

/** Attiva o disattiva l'area Privati online. Il database rifiuta l'attivazione se mancano spese o condizioni definitive. */
export async function cambiaAttivazione(attiva: boolean): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const db = await creaClientServer();
  if (attiva) {
    const { data: motivo } = await db.rpc("area_privati_attivabile");
    if (motivo) return { messaggio: `Non si può attivare: ${motivo}.` };
  }
  const { error } = await db.from("impostazioni").update({ area_privati_attiva: attiva }).eq("id", true);
  if (error) return { messaggio: error.message.replace(/^.*Area Privati non attivabile: /, "Non si può attivare: ") };
  await registraOperazione(db, utente.id, { azione: attiva ? "attiva_area_privati" : "disattiva_area_privati", entita: "impostazioni" });
  revalidatePath("/", "layout");
  return { ok: true, messaggio: attiva ? "Area Privati attivata online." : "Area Privati disattivata." };
}
