// UNICA FONTE degli stati di lotti e prodotti (docs/REGOLE_COMMERCIALI.md §3).
// La quantità disponibile (giacenza − impegnato) arriva dal database
// (funzione disponibilita_lotti), che la usa anche per l'impegno transazionale.
//
// Priorità: 1. difformità  2. lotto senza scadenza  3. lotto scaduto
//           4. prodotto senza prezzo  5. disponibile (con fascia di sconto)

import { aggiungiMesi, type DataISO } from "@/lib/date";

export type StatoLotto =
  | "difformita" // tutto il prodotto: somma lotti ≠ giacenza dichiarata
  | "mancante" // lotto senza data di scadenza
  | "scaduto" // non vendibile, non mostrato
  | "non_vendibile" // sotto la soglia "non vendibile" (predisposta, di norma spenta)
  | "prezzo_mancante" // prodotto senza prezzo: non visibile
  | "esaurito" // tutto impegnato
  | "vendibile";

export type StatoProdotto =
  | "non_visibile"
  | "mancante_temporaneamente"
  | "mancante"
  | "non_disponibile"
  | "in_esaurimento"
  | "disponibile";

export const ETICHETTE_STATO_PRODOTTO: Record<StatoProdotto, { testo: string; classe: string }> = {
  disponibile: { testo: "Disponibile", classe: "pill-ok" },
  in_esaurimento: { testo: "In esaurimento", classe: "pill-warn" },
  mancante_temporaneamente: { testo: "Mancante temporaneamente", classe: "pill-bad" },
  mancante: { testo: "Mancante", classe: "pill-bad" },
  non_disponibile: { testo: "Non disponibile", classe: "pill-off" },
  non_visibile: { testo: "Non visibile", classe: "pill-off" },
};

export type LottoPerStato = {
  deposito_id: string;
  scadenza: DataISO | null;
  giacenza: number;
  disponibile: number;
};

export type ProdottoPerStato = {
  prezzo_pubblico_cent: number | null;
  attivo: boolean;
  soglia_esaurimento: number | null;
};

/** Difformità: per almeno un deposito la somma dei lotti non coincide con il totale dichiarato. */
export function haDifformita(lotti: LottoPerStato[], dichiarati: { deposito_id: string; totale_dichiarato: number }[]): boolean {
  return dichiarati.some(
    (d) => lotti.filter((l) => l.deposito_id === d.deposito_id).reduce((s, l) => s + l.giacenza, 0) !== d.totale_dichiarato,
  );
}

export function statoLotto(
  lotto: LottoPerStato,
  contesto: { oggi: DataISO; difforme: boolean; conPrezzo: boolean; mesiNonVendibile?: number | null },
): StatoLotto {
  if (contesto.difforme) return "difformita";
  if (!lotto.scadenza) return "mancante";
  if (lotto.scadenza < contesto.oggi) return "scaduto";
  if (contesto.mesiNonVendibile != null && lotto.scadenza < aggiungiMesi(contesto.oggi, contesto.mesiNonVendibile)) return "non_vendibile";
  if (!contesto.conPrezzo) return "prezzo_mancante";
  if (lotto.disponibile <= 0) return "esaurito";
  return "vendibile";
}

export function statoProdotto(
  prodotto: ProdottoPerStato,
  lotti: (LottoPerStato & { stato: StatoLotto })[],
  opzioni: { difforme: boolean; sogliaEsaurimentoPredefinita: number },
): { stato: StatoProdotto; disponibile: number } {
  if (!prodotto.attivo || prodotto.prezzo_pubblico_cent == null) return { stato: "non_visibile", disponibile: 0 };
  if (opzioni.difforme) return { stato: "mancante_temporaneamente", disponibile: 0 };
  const disponibile = lotti.filter((l) => l.stato === "vendibile").reduce((s, l) => s + l.disponibile, 0);
  if (disponibile > 0) {
    const soglia = prodotto.soglia_esaurimento ?? opzioni.sogliaEsaurimentoPredefinita;
    return { stato: disponibile < soglia ? "in_esaurimento" : "disponibile", disponibile };
  }
  if (lotti.some((l) => l.stato === "mancante")) return { stato: "mancante", disponibile: 0 };
  return { stato: "non_disponibile", disponibile: 0 };
}

/** I lotti scaduti e non vendibili non si mostrano alle farmacie. */
export function lottoVisibile(stato: StatoLotto): boolean {
  return stato !== "scaduto" && stato !== "non_vendibile" && stato !== "prezzo_mancante";
}
