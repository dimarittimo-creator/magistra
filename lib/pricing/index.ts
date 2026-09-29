// UNICA FONTE di prezzi e sconti (docs/REGOLE_COMMERCIALI.md §2 e §4).
// Usata da catalogo, carrello, invio ordine, email, PDF, export, chatbot.
// Importi sempre in centesimi interi; percentuali come numeri (38 = 38%).
//
//   pubblico_ivato = prezzo di listino
//   pubblico_netto = round2(pubblico_ivato / (1 + iva))
//   farmacia_ivato = round2(pubblico_ivato × (1 − sconto))
//   farmacia_netto = round2(farmacia_ivato / (1 + iva))

import { aggiungiMesi, type DataISO } from "@/lib/date";

export type Fascia = { mesi_minimi: number; sconto_percentuale: number };

export type Prezzi = {
  pubblicoIvatoCent: number;
  pubblicoNettoCent: number;
  farmaciaIvatoCent: number;
  farmaciaNettoCent: number;
};

export type OrigineSconto = "fascia" | "lotto" | "promozione" | "listino_gruppo" | "sconto_privati";

/** Percentuale in centesimi di punto (38,5% → 3850), per fare i conti con interi esatti. */
function inBasePoint(percentuale: number): number {
  return Math.round(percentuale * 100);
}

/** Divisione con arrotondamento a metà verso l'alto (come ARROTONDA di Excel sui positivi). */
function dividiArrotonda(numeratore: number, denominatore: number): number {
  return Math.floor((2 * numeratore + denominatore) / (2 * denominatore));
}

export function scorporaIva(ivatoCent: number, ivaPercentuale: number): number {
  return dividiArrotonda(ivatoCent * 10000, 10000 + inBasePoint(ivaPercentuale));
}

export function applicaSconto(cent: number, scontoPercentuale: number): number {
  return dividiArrotonda(cent * (10000 - inBasePoint(scontoPercentuale)), 10000);
}

export function calcolaPrezzi(prezzoPubblicoCent: number, ivaPercentuale: number, scontoPercentuale: number): Prezzi {
  const farmaciaIvatoCent = applicaSconto(prezzoPubblicoCent, scontoPercentuale);
  return {
    pubblicoIvatoCent: prezzoPubblicoCent,
    pubblicoNettoCent: scorporaIva(prezzoPubblicoCent, ivaPercentuale),
    farmaciaIvatoCent,
    farmaciaNettoCent: scorporaIva(farmaciaIvatoCent, ivaPercentuale),
  };
}

/**
 * Fascia di sconto di un lotto rispetto alla data di oggi:
 * la fascia con più mesi tale che scadenza ≥ oggi + mesi (EDATE).
 * Restituisce null se nessuna fascia si applica (lotto scaduto).
 */
export function fasciaPerScadenza(scadenza: DataISO, oggi: DataISO, fasce: Fascia[]): (Fascia & { numero: number }) | null {
  const ordinate = [...fasce].sort((a, b) => b.mesi_minimi - a.mesi_minimi);
  const i = ordinate.findIndex((f) => scadenza >= aggiungiMesi(oggi, f.mesi_minimi));
  return i === -1 ? null : { ...ordinate[i], numero: i + 1 };
}

export type ScontoLotto = { sconto: number; origine: OrigineSconto; fascia: number | null; promozioneId?: string | null };

/**
 * Sconto che vale per un lotto: sconto manuale del lotto se c'è, altrimenti la fascia di scadenza.
 * Se c'è una promozione attiva vale il migliore dei due, non la somma (§4).
 */
export function scontoPerLotto(opzioni: {
  scadenza: DataISO;
  oggi: DataISO;
  fasce: Fascia[];
  scontoManuale?: number | null;
  promozione?: { id: string; sconto: number } | null;
}): ScontoLotto | null {
  const fascia = fasciaPerScadenza(opzioni.scadenza, opzioni.oggi, opzioni.fasce);
  if (!fascia) return null;
  let migliore: ScontoLotto =
    opzioni.scontoManuale != null
      ? { sconto: opzioni.scontoManuale, origine: "lotto", fascia: fascia.numero }
      : { sconto: fascia.sconto_percentuale, origine: "fascia", fascia: fascia.numero };
  if (opzioni.promozione && opzioni.promozione.sconto > migliore.sconto) {
    migliore = { sconto: opzioni.promozione.sconto, origine: "promozione", fascia: fascia.numero, promozioneId: opzioni.promozione.id };
  }
  return migliore;
}

export type RigaDaTotalizzare = {
  quantita: number;
  ivaPercentuale: number;
  prezzi: Prezzi;
};

export type Totali = {
  imponibileCent: number;
  /** Differenza tra prezzo al pubblico e prezzo farmacia, IVA esclusa. */
  scontiCent: number;
  ivaCent: number;
  ivaDettaglio: { aliquota: number; imponibileCent: number; ivaCent: number }[];
  totaleCent: number;
};

/** Imponibile = Σ farmacia_netto × quantità; IVA calcolata per aliquota sul totale imponibile. */
export function calcolaTotali(righe: RigaDaTotalizzare[]): Totali {
  const perAliquota = new Map<number, number>();
  let imponibileCent = 0;
  let scontiCent = 0;
  for (const r of righe) {
    const imponibileRiga = r.prezzi.farmaciaNettoCent * r.quantita;
    imponibileCent += imponibileRiga;
    scontiCent += (r.prezzi.pubblicoNettoCent - r.prezzi.farmaciaNettoCent) * r.quantita;
    perAliquota.set(r.ivaPercentuale, (perAliquota.get(r.ivaPercentuale) ?? 0) + imponibileRiga);
  }
  const ivaDettaglio = [...perAliquota.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([aliquota, imp]) => ({ aliquota, imponibileCent: imp, ivaCent: dividiArrotonda(imp * inBasePoint(aliquota), 10000) }));
  const ivaCent = ivaDettaglio.reduce((s, d) => s + d.ivaCent, 0);
  return { imponibileCent, scontiCent, ivaCent, ivaDettaglio, totaleCent: imponibileCent + ivaCent };
}

/** Aliquota del prodotto: eccezione sul prodotto oppure quella predefinita nelle impostazioni. */
export function aliquotaProdotto(ivaOverride: number | null | undefined, ivaPredefinita: number): number {
  return ivaOverride ?? ivaPredefinita;
}
