import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Catalogo, LottoCatalogo, ProdottoCatalogo } from "@/lib/catalogo";
import { calcolaTotali, type Totali } from "@/lib/pricing";

export type RigaCarrello = {
  lottoId: string;
  quantita: number;
  prodotto: ProdottoCatalogo | null;
  lotto: LottoCatalogo | null;
  problemi: string[];
};

export type CarrelloVerificato = {
  righe: RigaCarrello[];
  totali: Totali;
  depositoId: string | null;
  problemiGenerali: string[];
  inviabile: boolean;
};

/** Righe salvate nel carrello della farmacia (la RLS limita alla propria). */
export async function leggiRigheCarrello(db: SupabaseClient, farmaciaId: string) {
  const { data, error } = await db
    .from("carrello_righe")
    .select("lotto_id, quantita")
    .eq("farmacia_id", farmaciaId)
    .order("aggiunto_il");
  if (error) throw new Error(error.message);
  return (data ?? []) as { lotto_id: string; quantita: number }[];
}

/**
 * Collega le righe al catalogo e controlla tutto ciò che impedisce l'invio:
 * lotto non più vendibile, quantità oltre il disponibile, minimo e multiplo del prodotto,
 * soglia minima d'ordine, un solo deposito di partenza.
 */
export function verificaCarrello(catalogo: Catalogo, salvate: { lotto_id: string; quantita: number }[]): CarrelloVerificato {
  const perLotto = new Map<string, { prodotto: ProdottoCatalogo; lotto: LottoCatalogo }>();
  for (const p of catalogo.prodotti) for (const l of p.lotti) perLotto.set(l.id, { prodotto: p, lotto: l });

  const righe: RigaCarrello[] = salvate.map((s) => {
    const trovato = perLotto.get(s.lotto_id);
    const problemi: string[] = [];
    if (!trovato || trovato.lotto.stato !== "vendibile" || !trovato.lotto.prezzi) {
      problemi.push("Lotto non più disponibile: toglilo dal carrello");
    } else if (s.quantita > trovato.lotto.disponibile) {
      problemi.push(`Disponibili solo ${trovato.lotto.disponibile} pezzi di questo lotto`);
    }
    return { lottoId: s.lotto_id, quantita: s.quantita, prodotto: trovato?.prodotto ?? null, lotto: trovato?.lotto ?? null, problemi };
  });

  // Minimo e multiplo si controllano sul totale del prodotto (anche su più lotti).
  const perProdotto = Map.groupBy(righe.filter((r) => r.prodotto), (r) => r.prodotto!.codice);
  for (const gruppo of perProdotto.values()) {
    const p = gruppo[0].prodotto!;
    const totale = gruppo.reduce((s, r) => s + r.quantita, 0);
    if (totale < p.minimo_ordine) gruppo[0].problemi.push(`Ordine minimo per questo prodotto: ${p.minimo_ordine} pezzi`);
    if (totale % p.multiplo !== 0) gruppo[0].problemi.push(`Per questo prodotto la quantità totale deve essere multipla di ${p.multiplo}`);
  }

  const valide = righe.filter((r) => r.lotto?.prezzi && r.prodotto);
  const totali = calcolaTotali(valide.map((r) => ({ quantita: r.quantita, ivaPercentuale: r.prodotto!.iva, prezzi: r.lotto!.prezzi! })));

  const problemiGenerali: string[] = [];
  const depositi = new Set(valide.map((r) => r.lotto!.deposito_id));
  if (depositi.size > 1) problemiGenerali.push("I lotti nel carrello partono da depositi diversi: invia un ordine per ogni deposito");
  const soglia = catalogo.impostazioni.soglia_minima_ordine_cent;
  if (soglia && totali.imponibileCent < soglia) {
    problemiGenerali.push(`L'ordine minimo è di ${(soglia / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })} IVA esclusa`);
  }
  if (righe.length === 0) problemiGenerali.push("Il carrello è vuoto");

  return {
    righe,
    totali,
    depositoId: depositi.size === 1 ? [...depositi][0] : null,
    problemiGenerali,
    inviabile: righe.length > 0 && righe.every((r) => r.problemi.length === 0) && problemiGenerali.length === 0,
  };
}
