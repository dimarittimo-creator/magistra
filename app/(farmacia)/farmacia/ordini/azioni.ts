"use server";

import { revalidatePath } from "next/cache";
import { richiediFarmaciaAttiva } from "@/lib/auth";
import { leggiRigheCarrello } from "@/lib/carrello";
import { caricaCatalogo } from "@/lib/catalogo";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { leggiOrdine } from "@/lib/ordini/lettura";
import { rispondiModifiche } from "@/lib/ordini/modifiche";
import { creaClientServer } from "@/lib/supabase/server";

/**
 * Ripete un ordine: rimette nel carrello gli stessi prodotti. Se il lotto di allora non c'è più
 * si usa il lotto vendibile con il prezzo migliore; le quantità si riducono al disponibile.
 */
export async function ripetiOrdine(ordineId: string): Promise<StatoModulo> {
  const { farmaciaId } = await richiediFarmaciaAttiva();
  const db = await creaClientServer();
  const [ordine, catalogo, carrello] = await Promise.all([leggiOrdine(db, ordineId), caricaCatalogo(db, { farmaciaId }), leggiRigheCarrello(db, farmaciaId)]);
  if (!ordine || ordine.farmacia_id !== farmaciaId) return { messaggio: "Ordine non trovato." };

  const nelCarrello = new Map(carrello.map((r) => [r.lotto_id, r.quantita]));
  const avvisi: string[] = [];
  let aggiunte = 0;

  for (const r of ordine.righe) {
    if (r.quantita === 0) continue; // riga di solo omaggio: torna da sola se la promozione è ancora attiva
    const prodotto = catalogo.prodotti.find((p) => p.codice === r.prodotto_codice);
    const vendibili = prodotto?.lotti.filter((l) => l.stato === "vendibile" && l.prezzi) ?? [];
    const libero = (id: string, disponibile: number) => disponibile - (nelCarrello.get(id) ?? 0);
    const lotto =
      vendibili.find((l) => l.id === r.lotto_id && libero(l.id, l.disponibile) > 0) ??
      [...vendibili].filter((l) => libero(l.id, l.disponibile) > 0).sort((a, b) => a.prezzi!.farmaciaNettoCent - b.prezzi!.farmaciaNettoCent)[0];
    if (!lotto) {
      avvisi.push(`${r.prodotto_nome}: non disponibile`);
      continue;
    }
    const quantita = Math.min(r.quantita, libero(lotto.id, lotto.disponibile));
    if (lotto.id !== r.lotto_id) avvisi.push(`${r.prodotto_nome}: lotto ${r.codice_lotto} esaurito, messo il lotto ${lotto.codice_lotto}`);
    if (quantita < r.quantita) avvisi.push(`${r.prodotto_nome}: disponibili solo ${quantita} pezzi`);
    const totale = (nelCarrello.get(lotto.id) ?? 0) + quantita;
    const { error } = await db.from("carrello_righe").upsert({ farmacia_id: farmaciaId, lotto_id: lotto.id, quantita: totale });
    if (error) return { messaggio: "Non è stato possibile aggiornare il carrello. Riprova." };
    nelCarrello.set(lotto.id, totale);
    aggiunte++;
  }

  revalidatePath("/farmacia", "layout");
  if (aggiunte === 0) return { messaggio: `Nessun prodotto di questo ordine è disponibile ora. ${avvisi.join(" · ")}` };
  return {
    ok: true,
    messaggio: `${aggiunte === 1 ? "1 prodotto aggiunto" : `${aggiunte} prodotti aggiunti`} al carrello.${avvisi.length ? ` Attenzione: ${avvisi.join(" · ")}.` : ""}`,
  };
}

/** La farmacia accetta o rifiuta le modifiche fatte dall'amministrazione (condizioni di vendita art. 4.3). */
export async function rispondiModificheFarmacia(ordineId: string, accetta: boolean, _prima: StatoModulo): Promise<StatoModulo> {
  const utente = await richiediFarmaciaAttiva();
  const ordine = await leggiOrdine(await creaClientServer(), ordineId);
  if (!ordine || ordine.farmacia_id !== utente.farmaciaId) return { messaggio: "Ordine non trovato." };
  const esito = await rispondiModifiche(ordineId, utente.id, accetta);
  revalidatePath(`/farmacia/ordini/${ordineId}`);
  return { ok: esito.ok, messaggio: esito.messaggio };
}
