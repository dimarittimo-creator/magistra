"use server";

import { revalidatePath } from "next/cache";
import { richiediAdmin } from "@/lib/auth";
import { leggi, valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { registraOperazione } from "@/lib/registro";
import { creaClientServer } from "@/lib/supabase/server";

async function idPerNome(db: Awaited<ReturnType<typeof creaClientServer>>, tabella: "linee" | "aree_terapeutiche", nome: string) {
  if (!nome) return null;
  const { data } = await db.from(tabella).select("id").ilike("nome", nome).maybeSingle();
  if (data) return data.id as string;
  const { data: nuovo } = await db.from(tabella).insert({ nome }).select("id").single();
  return (nuovo?.id as string) ?? null;
}

export async function salvaProdotto(codice: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const valori = valoriModulo(fd);
  const errori: Record<string, string> = {};
  const intero = (nome: string, min: number) => {
    const t = leggi(fd, nome);
    if (!t) return null;
    const n = Number(t);
    if (!Number.isInteger(n) || n < min) errori[nome] = `Numero intero da ${min} in su`;
    return n;
  };
  const prezzoTesto = leggi(fd, "prezzo").replace(",", ".");
  const prezzo = prezzoTesto ? Math.round(Number(prezzoTesto) * 100) : null;
  if (prezzoTesto && (!Number.isFinite(prezzo) || prezzo! <= 0)) errori.prezzo = "Prezzo non valido";
  const ivaTesto = leggi(fd, "iva").replace(",", ".");
  const iva = ivaTesto ? Number(ivaTesto) : null;
  if (iva != null && (!Number.isFinite(iva) || iva < 0 || iva > 100)) errori.iva = "Aliquota non valida";

  const dati = {
    nome: leggi(fd, "nome"),
    formato: leggi(fd, "formato") || null,
    descrizione: leggi(fd, "descrizione") || null,
    prezzo_pubblico_cent: prezzo,
    iva_override: iva,
    minimo_ordine: intero("minimo_ordine", 1) ?? 1,
    multiplo: intero("multiplo", 1) ?? 1,
    soglia_esaurimento: intero("soglia_esaurimento", 0),
    visibile_privati: Boolean(fd.get("visibile_privati")),
    attivo: Boolean(fd.get("attivo")),
  };
  if (!dati.nome) errori.nome = "Indica il nome del prodotto";
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlla i campi evidenziati." };

  const db = await creaClientServer();
  const { data: prima } = await db.from("prodotti").select("*").eq("codice", codice).single();
  const completi = {
    ...dati,
    linea_id: await idPerNome(db, "linee", leggi(fd, "linea")),
    area_id: await idPerNome(db, "aree_terapeutiche", leggi(fd, "area")),
  };
  const { error } = await db.from("prodotti").update(completi).eq("codice", codice);
  if (error) return { valori, messaggio: "Salvataggio non riuscito. Riprova." };
  await registraOperazione(db, utente.id, { azione: "modifica_prodotto", entita: "prodotti", entitaId: codice, prima, dopo: completi });
  revalidatePath("/", "layout");
  return { ok: true, valori, messaggio: "Prodotto salvato." };
}
