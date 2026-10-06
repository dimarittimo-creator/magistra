import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { caricaCatalogo, type Catalogo, type LottoCatalogo, type ProdottoCatalogo } from "@/lib/catalogo";
import { calcolaTotali, type Totali } from "@/lib/pricing";
import { calcolaOmaggiExtra, pezziOmaggio, type OmaggioExtra } from "@/lib/promozioni";

export type RigaCarrello = {
  lottoId: string;
  quantita: number;
  /** Pezzi gratis dello stesso lotto (sconto merce) o, per le righe omaggio, i pezzi regalati */
  quantitaOmaggio: number;
  /** Riga aggiunta automaticamente da una promozione "omaggio": non modificabile */
  omaggio: { promozioneId: string; nome: string } | null;
  promozioneMerceId: string | null;
  prodotto: ProdottoCatalogo | null;
  lotto: LottoCatalogo | null;
  problemi: string[];
  avvisi: string[];
};

export type CarrelloVerificato = {
  righe: RigaCarrello[];
  totali: Totali;
  /** Omaggi extra non a magazzino spettanti (es. espositori) */
  omaggiExtra: OmaggioExtra[];
  /** Lotti con durata residua inferiore a quella garantita: serve l'accettazione espressa (condizioni art. 7.1) */
  lottiDurataRidotta: { prodotto: string; lotto: string; scadenza: string | null }[];
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
 * soglia minima d'ordine, un solo deposito di partenza. Aggiunge gli omaggi delle promozioni.
 */
export function verificaCarrello(catalogo: Catalogo, salvate: { lotto_id: string; quantita: number }[]): CarrelloVerificato {
  const perLotto = new Map<string, { prodotto: ProdottoCatalogo; lotto: LottoCatalogo }>();
  for (const p of catalogo.prodotti) for (const l of p.lotti) perLotto.set(l.id, { prodotto: p, lotto: l });
  // Pezzi già usati per lotto (acquisti + omaggi), per non promettere più del disponibile
  const usati = new Map<string, number>();
  const usa = (id: string, n: number) => usati.set(id, (usati.get(id) ?? 0) + n);

  const righe: RigaCarrello[] = salvate.map((s) => {
    const trovato = perLotto.get(s.lotto_id);
    const problemi: string[] = [];
    const avvisi: string[] = [];
    let quantitaOmaggio = 0;
    let promozioneMerceId: string | null = null;
    if (!trovato || trovato.lotto.stato !== "vendibile" || !trovato.lotto.prezzi) {
      problemi.push("Lotto non più disponibile: toglilo dal carrello");
    } else if (s.quantita > trovato.lotto.disponibile) {
      problemi.push(`Disponibili solo ${trovato.lotto.disponibile} pezzi di questo lotto`);
    } else {
      // Sconto merce sullo stesso lotto: gli omaggi impegnano giacenza, al massimo fino al disponibile
      const merce = trovato.lotto.promoMerce.find((p) => p.tipo === "sconto_merce");
      if (merce) {
        const spettanti = pezziOmaggio(merce, s.quantita);
        quantitaOmaggio = Math.min(spettanti, trovato.lotto.disponibile - s.quantita);
        if (quantitaOmaggio > 0) promozioneMerceId = merce.id;
        if (quantitaOmaggio < spettanti) avvisi.push(`Omaggio ridotto a ${quantitaOmaggio} pezzi: il lotto non ne ha abbastanza`);
      }
    }
    usa(s.lotto_id, s.quantita + quantitaOmaggio);
    return { lottoId: s.lotto_id, quantita: s.quantita, quantitaOmaggio, omaggio: null, promozioneMerceId, prodotto: trovato?.prodotto ?? null, lotto: trovato?.lotto ?? null, problemi, avvisi };
  });

  // Minimo e multiplo si controllano sul totale del prodotto (anche su più lotti).
  const perProdotto = Map.groupBy(righe.filter((r) => r.prodotto), (r) => r.prodotto!.codice);
  for (const gruppo of perProdotto.values()) {
    const p = gruppo[0].prodotto!;
    const totale = gruppo.reduce((s, r) => s + r.quantita, 0);
    if (totale < p.minimo_ordine) gruppo[0].problemi.push(`Ordine minimo per questo prodotto: ${p.minimo_ordine} pezzi`);
    if (totale % p.multiplo !== 0) gruppo[0].problemi.push(`Per questo prodotto la quantità totale deve essere multipla di ${p.multiplo}`);
  }

  // Promozioni "omaggio": ogni N pezzi acquistati, pezzi di un altro prodotto (lotto con la scadenza più vicina)
  const omaggi: RigaCarrello[] = [];
  const promoOmaggio = new Map<string, { promo: LottoCatalogo["promoMerce"][number]; quantita: number }>();
  for (const r of righe) {
    if (!r.lotto || r.problemi.length) continue;
    for (const p of r.lotto.promoMerce.filter((x) => x.tipo === "omaggio")) {
      const voce = promoOmaggio.get(p.id) ?? { promo: p, quantita: 0 };
      voce.quantita += r.quantita;
      promoOmaggio.set(p.id, voce);
    }
  }
  for (const { promo, quantita } of promoOmaggio.values()) {
    let daDare = pezziOmaggio(promo, quantita);
    if (!daDare) continue;
    const regalo = catalogo.prodotti.find((p) => p.codice === promo.omaggio_prodotto_codice);
    for (const l of regalo?.lotti.filter((x) => x.stato === "vendibile") ?? []) {
      const libero = l.disponibile - (usati.get(l.id) ?? 0);
      const n = Math.min(daDare, libero);
      if (n <= 0) continue;
      usa(l.id, n);
      omaggi.push({ lottoId: l.id, quantita: 0, quantitaOmaggio: n, omaggio: { promozioneId: promo.id, nome: promo.nome }, promozioneMerceId: promo.id, prodotto: regalo!, lotto: l, problemi: [], avvisi: [] });
      daDare -= n;
      if (!daDare) break;
    }
    if (daDare > 0) {
      const rif = righe.find((r) => r.lotto?.promoMerce.some((x) => x.id === promo.id));
      rif?.avvisi.push(`Omaggio «${promo.nome}»: ${daDare} pezzi non disponibili al momento`);
    }
  }

  const tutte = [...righe, ...omaggi];
  const valide = righe.filter((r) => r.lotto?.prezzi && r.prodotto);
  const totali = calcolaTotali(valide.map((r) => ({ quantita: r.quantita, ivaPercentuale: r.prodotto!.iva, prezzi: r.lotto!.prezzi! })));

  const problemiGenerali: string[] = [];
  const depositi = new Set(tutte.filter((r) => r.lotto).map((r) => r.lotto!.deposito_id));
  if (depositi.size > 1) problemiGenerali.push("I lotti nel carrello partono da depositi diversi: invia un ordine per ogni deposito");
  const soglia = catalogo.impostazioni.soglia_minima_ordine_cent;
  if (soglia && totali.imponibileCent < soglia) {
    problemiGenerali.push(`L'ordine minimo è di ${(soglia / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" })} IVA esclusa`);
  }
  if (righe.length === 0) problemiGenerali.push("Il carrello è vuoto");

  return {
    righe: tutte,
    totali,
    lottiDurataRidotta: valide.filter((r) => r.lotto!.durataRidotta).map((r) => ({ prodotto: r.prodotto!.nome, lotto: r.lotto!.codice_lotto, scadenza: r.lotto!.scadenza })),
    omaggiExtra: calcolaOmaggiExtra(valide.map((r) => ({ quantita: r.quantita, promoExtra: r.lotto!.promoExtra }))),
    depositoId: depositi.size === 1 ? [...depositi][0] : null,
    problemiGenerali,
    inviabile: righe.length > 0 && righe.every((r) => r.problemi.length === 0) && problemiGenerali.length === 0,
  };
}

/**
 * Aggiunge pezzi di un lotto al carrello della farmacia, senza superare il disponibile.
 * Unico punto usato dal catalogo e dalle conferme dell'assistente.
 */
export async function aggiungiLottoAlCarrello(
  db: SupabaseClient,
  farmaciaId: string,
  lottoId: string,
  quantita: number,
): Promise<{ ok: boolean; messaggio: string }> {
  const { data: riga } = await db.from("lotti").select("prodotto_codice").eq("id", lottoId).maybeSingle();
  if (!riga) return { ok: false, messaggio: "Lotto non trovato." };
  const catalogo = await caricaCatalogo(db, { codice: riga.prodotto_codice, farmaciaId });
  const lotto = catalogo.prodotti[0]?.lotti.find((l) => l.id === lottoId);
  if (!lotto || lotto.stato !== "vendibile") return { ok: false, messaggio: "Questo lotto non è più disponibile." };

  const { data: presente } = await db.from("carrello_righe").select("quantita").eq("farmacia_id", farmaciaId).eq("lotto_id", lottoId).maybeSingle();
  const totale = (presente?.quantita ?? 0) + quantita;
  if (totale > lotto.disponibile) {
    return {
      ok: false,
      messaggio: presente
        ? `Nel carrello hai già ${presente.quantita} pezzi di questo lotto: ne puoi aggiungere al massimo ${Math.max(lotto.disponibile - presente.quantita, 0)}.`
        : `Disponibili solo ${lotto.disponibile} pezzi di questo lotto.`,
    };
  }

  const { error } = await db.from("carrello_righe").upsert({ farmacia_id: farmaciaId, lotto_id: lottoId, quantita: totale });
  if (error) return { ok: false, messaggio: "Non è stato possibile aggiornare il carrello. Riprova." };
  return { ok: true, messaggio: `Nel carrello: ${totale} pezzi del lotto ${lotto.codice_lotto}.` };
}
