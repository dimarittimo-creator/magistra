// Promozioni (docs/REGOLE_COMMERCIALI.md §4): attive in automatico tra inizio e fine.
// - sconto percentuale: compete con lo sconto del lotto, vale il migliore (lib/pricing);
// - sconto merce "10+2": ogni `compra` pezzi, `omaggio_quantita` gratis dello stesso lotto;
// - omaggio: ogni `compra` pezzi, `omaggio_quantita` pezzi di un altro prodotto.
// Gli omaggi hanno prezzo zero ma impegnano giacenza. Funzioni pure: usate da catalogo, carrello e admin.

import type { DataISO } from "@/lib/date";

export type Promozione = {
  id: string;
  nome: string;
  tipo: "sconto_percentuale" | "sconto_merce" | "omaggio";
  sconto_percentuale: number | null;
  compra: number | null;
  omaggio_quantita: number | null;
  omaggio_prodotto_codice: string | null;
  ambito: "catalogo" | "linea" | "prodotto" | "lotto";
  prodotto_codice: string | null;
  lotto_id: string | null;
  linea_id: string | null;
  gruppo_id: string | null;
  inizio: DataISO;
  fine: DataISO;
  sospesa: boolean;
};

export type StatoPromozione = "programmata" | "attiva" | "conclusa" | "sospesa";

export function statoPromozione(p: Pick<Promozione, "inizio" | "fine" | "sospesa">, oggi: DataISO): StatoPromozione {
  if (p.sospesa) return "sospesa";
  if (oggi < p.inizio) return "programmata";
  if (oggi > p.fine) return "conclusa";
  return "attiva";
}

/** La promozione vale per questa farmacia (gruppo) e per questo lotto di prodotto? */
export function promozioneSiApplica(
  p: Promozione,
  cosa: { prodotto: string; lineaId: string | null; lottoId: string },
  chi: { gruppoId: string | null },
  oggi: DataISO,
): boolean {
  if (statoPromozione(p, oggi) !== "attiva") return false;
  if (p.gruppo_id && p.gruppo_id !== chi.gruppoId) return false;
  switch (p.ambito) {
    case "catalogo":
      return true;
    case "linea":
      return !!cosa.lineaId && p.linea_id === cosa.lineaId;
    case "prodotto":
      return p.prodotto_codice === cosa.prodotto;
    case "lotto":
      return p.lotto_id === cosa.lottoId;
  }
}

/** Promozione di tipo sconto percentuale più conveniente tra quelle che si applicano. */
export function migliorScontoPromo(promo: Promozione[], cosa: Parameters<typeof promozioneSiApplica>[1], chi: { gruppoId: string | null }, oggi: DataISO) {
  return promo
    .filter((p) => p.tipo === "sconto_percentuale" && promozioneSiApplica(p, cosa, chi, oggi))
    .reduce<{ id: string; sconto: number } | null>((m, p) => (!m || Number(p.sconto_percentuale) > m.sconto ? { id: p.id, sconto: Number(p.sconto_percentuale) } : m), null);
}

/** Promozioni di merce (sconto merce, omaggi) che si applicano: servono a carrello e scheda prodotto. */
export function promoMerce(promo: Promozione[], cosa: Parameters<typeof promozioneSiApplica>[1], chi: { gruppoId: string | null }, oggi: DataISO) {
  return promo.filter((p) => p.tipo !== "sconto_percentuale" && promozioneSiApplica(p, cosa, chi, oggi));
}

/** Pezzi in omaggio spettanti per una quantità acquistata. */
export function pezziOmaggio(p: Pick<Promozione, "compra" | "omaggio_quantita">, quantita: number): number {
  if (!p.compra || !p.omaggio_quantita) return 0;
  return Math.floor(quantita / p.compra) * p.omaggio_quantita;
}

export function descriviPromozione(
  p: Pick<Promozione, "tipo" | "compra" | "omaggio_quantita"> & { sconto_percentuale?: number | null },
  nomeOmaggio?: string,
): string {
  if (p.tipo === "sconto_percentuale") return `sconto ${Number(p.sconto_percentuale).toLocaleString("it-IT")}%`;
  if (p.tipo === "sconto_merce") return `${p.compra}+${p.omaggio_quantita}: ogni ${p.compra} pezzi, ${p.omaggio_quantita} in omaggio`;
  return `ogni ${p.compra} pezzi, ${p.omaggio_quantita} ${nomeOmaggio ?? "pezzi"} in omaggio`;
}
