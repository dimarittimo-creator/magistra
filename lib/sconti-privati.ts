// Sconti privati del mese (docs/AREA_PRIVATI.md §3): globale, per linea o per prodotto, con periodo di validità.
// Se più sconti valgono per lo stesso prodotto vale il migliore, mai la somma. A fine periodo scadono da soli.

import { aggiungiGiorni, aggiungiMesi, type DataISO } from "@/lib/date";

export type ScontoPrivati = {
  id: string;
  ambito: "catalogo" | "linea" | "prodotto";
  linea_id: string | null;
  prodotto_codice: string | null;
  sconto_percentuale: number;
  inizio: DataISO;
  fine: DataISO;
};

export function scontoAttivo(s: Pick<ScontoPrivati, "inizio" | "fine">, oggi: DataISO): boolean {
  return s.inizio <= oggi && oggi <= s.fine;
}

/** Sconto del mese migliore per un prodotto oggi (null se nessuno). */
export function migliorScontoPrivati(sconti: ScontoPrivati[], prodotto: { codice: string; lineaId: string | null }, oggi: DataISO): ScontoPrivati | null {
  return sconti
    .filter((s) => scontoAttivo(s, oggi))
    .filter((s) => s.ambito === "catalogo" || (s.ambito === "linea" && s.linea_id === prodotto.lineaId) || (s.ambito === "prodotto" && s.prodotto_codice === prodotto.codice))
    .reduce<ScontoPrivati | null>((m, s) => (!m || Number(s.sconto_percentuale) > Number(m.sconto_percentuale) ? s : m), null);
}

export function primoDelMese(data: DataISO): DataISO {
  return `${data.slice(0, 7)}-01`;
}

export function ultimoDelMese(data: DataISO): DataISO {
  return aggiungiGiorni(aggiungiMesi(primoDelMese(data), 1), -1);
}

/**
 * Periodo del mese successivo per "Copia sul mese successivo": se lo sconto copre un mese intero
 * diventa il mese intero successivo, altrimenti si spostano le date di un mese.
 */
export function periodoMeseSuccessivo(s: Pick<ScontoPrivati, "inizio" | "fine">): { inizio: DataISO; fine: DataISO } {
  const meseIntero = s.inizio === primoDelMese(s.inizio) && s.fine === ultimoDelMese(s.inizio);
  if (meseIntero) {
    const inizio = aggiungiMesi(s.inizio, 1);
    return { inizio, fine: ultimoDelMese(inizio) };
  }
  return { inizio: aggiungiMesi(s.inizio, 1), fine: aggiungiMesi(s.fine, 1) };
}

/** Promemoria: 5 giorni prima della fine del mese, se il mese successivo non ha sconti. */
export function servePromemoria(sconti: Pick<ScontoPrivati, "inizio" | "fine">[], oggi: DataISO): boolean {
  if (oggi !== aggiungiGiorni(ultimoDelMese(oggi), -5)) return false;
  const inizioProssimo = aggiungiMesi(primoDelMese(oggi), 1);
  const fineProssimo = ultimoDelMese(inizioProssimo);
  return !sconti.some((s) => s.inizio <= fineProssimo && s.fine >= inizioProssimo);
}
