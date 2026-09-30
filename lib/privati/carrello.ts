import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lottiPerQuantita, type Negozio, type ProdottoNegozioInterno } from "@/lib/negozio";
import { calcolaTotaliPrivati, speseSpedizione } from "@/lib/pricing";

export type RegolaSpese = { importo_cent: number | null; soglia_gratuita_cent: number | null; iva: number };

export type RigaCarrelloPrivato = {
  codice: string;
  quantita: number;
  prodotto: ProdottoNegozioInterno | null;
  lotti: { lottoId: string; codiceLotto: string; scadenza: string; depositoId: string; quantita: number }[];
  problema: string | null;
};

export async function leggiCarrelloPrivato(db: SupabaseClient, privatoId: string) {
  const { data } = await db.from("carrello_privati").select("prodotto_codice, quantita").eq("privato_id", privatoId).order("aggiunto_il");
  return (data ?? []) as { prodotto_codice: string; quantita: number }[];
}

export async function leggiRegolaSpese(db: SupabaseClient): Promise<RegolaSpese | null> {
  const { data } = await db.from("spese_spedizione").select("importo_cent, soglia_gratuita_cent, iva, attiva").eq("canale", "privati").maybeSingle();
  return data?.attiva ? { importo_cent: data.importo_cent, soglia_gratuita_cent: data.soglia_gratuita_cent, iva: Number(data.iva) } : null;
}

/**
 * Collega il carrello al negozio, assegna i lotti (scadenza più vicina con almeno N mesi di vita residua)
 * e calcola spese e totali. Il cliente non vede lotti né quantità disponibili: solo se può ordinare.
 */
export function verificaCarrelloPrivato(negozio: Negozio, salvate: { prodotto_codice: string; quantita: number }[], spese: RegolaSpese | null, costoPagamentoCent = 0) {
  const righe: RigaCarrelloPrivato[] = salvate.map((s) => {
    const prodotto = negozio.prodotti.find((p) => p.codice === s.prodotto_codice) ?? null;
    if (!prodotto) return { codice: s.prodotto_codice, quantita: s.quantita, prodotto: null, lotti: [], problema: "Prodotto non più in vendita: toglilo dal carrello" };
    const assegnati = lottiPerQuantita(prodotto, s.quantita, negozio);
    if (!assegnati) {
      return {
        codice: s.prodotto_codice, quantita: s.quantita, prodotto, lotti: [],
        problema: prodotto.disponibile ? "Quantità non disponibile: prova con meno pezzi" : "Al momento non disponibile",
      };
    }
    return {
      codice: s.prodotto_codice, quantita: s.quantita, prodotto,
      lotti: assegnati.map((a) => ({ lottoId: a.lotto.id, codiceLotto: a.lotto.codice_lotto, scadenza: a.lotto.scadenza!, depositoId: a.lotto.deposito_id, quantita: a.quantita })),
      problema: null,
    };
  });

  const valide = righe.filter((r) => r.prodotto && !r.problema);
  const prodottiCent = valide.reduce((s, r) => s + r.prodotto!.prezzo.ivatoCent * r.quantita, 0);
  const speseCent = speseSpedizione(prodottiCent, spese);
  const totali = calcolaTotaliPrivati(
    valide.map((r) => ({ quantita: r.quantita, ivaPercentuale: r.prodotto!.iva, prezzo: r.prodotto!.prezzo })),
    speseCent == null ? null : { ivatoCent: speseCent + costoPagamentoCent, ivaPercentuale: spese!.iva },
  );
  const depositi = new Set(valide.flatMap((r) => r.lotti.map((l) => l.depositoId)));
  const problemiGenerali: string[] = [];
  if (!righe.length) problemiGenerali.push("Il carrello è vuoto");
  if (speseCent == null) problemiGenerali.push("Le spese di spedizione non sono ancora disponibili: per ora non è possibile completare l'ordine");
  if (depositi.size > 1) problemiGenerali.push("Alcuni prodotti partono da magazzini diversi: invia ordini separati");

  return {
    righe,
    totali,
    speseCent,
    depositoId: depositi.size === 1 ? [...depositi][0] : null,
    problemiGenerali,
    inviabile: righe.length > 0 && righe.every((r) => !r.problema) && !problemiGenerali.length,
  };
}
