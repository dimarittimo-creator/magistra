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
  /** Volantino (percorso nell'archivio "promozioni") */
  immagine_path?: string | null;
  /** Omaggio extra non a magazzino, es. "espositore Primus Task": ogni `omaggio_extra_ogni` pezzi, `omaggio_extra_quantita` */
  omaggio_extra_testo?: string | null;
  omaggio_extra_ogni?: number | null;
  omaggio_extra_quantita?: number | null;
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

export type PromoExtra = { id: string; nome: string; testo: string; ogni: number; quantita: number };
export type OmaggioExtra = { promozione_id: string; nome: string; testo: string; quantita: number };

/** Dati dell'omaggio extra di una promozione, se ce l'ha. */
export function promoExtra(p: Promozione): PromoExtra | null {
  if (!p.omaggio_extra_testo || !p.omaggio_extra_ogni || !p.omaggio_extra_quantita) return null;
  return { id: p.id, nome: p.nome, testo: p.omaggio_extra_testo, ogni: p.omaggio_extra_ogni, quantita: p.omaggio_extra_quantita };
}

/**
 * Omaggi extra spettanti (es. 1 espositore ogni 24 pezzi): i pezzi acquistati si sommano su tutte le righe
 * a cui la promozione si applica, anche su lotti diversi. Gli omaggi extra non impegnano giacenza.
 */
export function calcolaOmaggiExtra(righe: { quantita: number; promoExtra: PromoExtra[] }[]): OmaggioExtra[] {
  const perPromo = new Map<string, { promo: PromoExtra; pezzi: number }>();
  for (const r of righe) {
    for (const p of r.promoExtra) {
      const voce = perPromo.get(p.id) ?? { promo: p, pezzi: 0 };
      voce.pezzi += r.quantita;
      perPromo.set(p.id, voce);
    }
  }
  return [...perPromo.values()]
    .map(({ promo, pezzi }) => ({ promozione_id: promo.id, nome: promo.nome, testo: promo.testo, quantita: Math.floor(pezzi / promo.ogni) * promo.quantita }))
    .filter((o) => o.quantita > 0);
}

/** Indirizzo pubblico del volantino (archivio "promozioni" di Supabase Storage). */
export function urlVolantino(percorso: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/promozioni/${percorso}`;
}

/** Descrizione per le farmacie: "1 espositore Primus Task ogni 24 pezzi". */
export function descriviOmaggioExtra(p: Pick<PromoExtra, "testo" | "ogni" | "quantita">): string {
  return `${p.quantita} ${p.testo} in omaggio ogni ${p.ogni} pezzi`;
}
