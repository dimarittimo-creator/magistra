"use server";

import { revalidatePath } from "next/cache";
import { richiediAdmin } from "@/lib/auth";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { registraOperazione } from "@/lib/registro";
import { creaClientServer } from "@/lib/supabase/server";

export type VoceListino = { codice: string; prezzo: string; sconto: string };

/** Salva il listino dedicato di un gruppo: righe vuote = nessuna condizione speciale per quel prodotto. */
export async function salvaListino(gruppoId: string, voci: VoceListino[]): Promise<StatoModulo & { righe?: Record<string, string> }> {
  const utente = await richiediAdmin();
  const errori: Record<string, string> = {};
  const daSalvare: { gruppo_id: string; prodotto_codice: string; prezzo_pubblico_cent: number | null; sconto_percentuale: number | null }[] = [];
  const daTogliere: string[] = [];
  for (const v of voci) {
    const p = v.prezzo.trim() ? Math.round(Number(v.prezzo.replace(",", ".")) * 100) : null;
    const s = v.sconto.trim() ? Number(v.sconto.replace(",", ".")) : null;
    if (p != null && (!Number.isFinite(p) || p <= 0)) errori[v.codice] = "Prezzo non valido";
    if (s != null && (!Number.isFinite(s) || s < 0 || s > 100)) errori[v.codice] = "Sconto tra 0 e 100%";
    if (p == null && s == null) daTogliere.push(v.codice);
    else daSalvare.push({ gruppo_id: gruppoId, prodotto_codice: v.codice, prezzo_pubblico_cent: p, sconto_percentuale: s });
  }
  if (Object.keys(errori).length) return { righe: errori, messaggio: "Controlla le righe evidenziate." };

  const db = await creaClientServer();
  if (daSalvare.length) {
    const { error } = await db.from("listini_gruppo").upsert(daSalvare, { onConflict: "gruppo_id,prodotto_codice" });
    if (error) return { messaggio: "Salvataggio non riuscito. Riprova." };
  }
  if (daTogliere.length) await db.from("listini_gruppo").delete().eq("gruppo_id", gruppoId).in("prodotto_codice", daTogliere);
  await registraOperazione(db, utente.id, { azione: "modifica_listino_gruppo", entita: "gruppi", entitaId: gruppoId, dopo: { salvati: daSalvare, tolti: daTogliere } });
  revalidatePath("/", "layout");
  return { ok: true, messaggio: "Listino del gruppo salvato: le farmacie del gruppo vedono subito i nuovi prezzi." };
}
