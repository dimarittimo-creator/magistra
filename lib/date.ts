// Date di calendario come testo "aaaa-mm-gg" (niente orari né fusi: una scadenza è un giorno).

export type DataISO = string;

/** Oggi nel fuso di Roma, come "aaaa-mm-gg". */
export function oggiRoma(adesso: Date = new Date()): DataISO {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(adesso);
}

function parti(d: DataISO): [number, number, number] {
  const [a, m, g] = d.split("-").map(Number);
  return [a, m, g];
}

function giorniNelMese(anno: number, mese: number): number {
  return new Date(Date.UTC(anno, mese, 0)).getUTCDate();
}

function componi(anno: number, mese: number, giorno: number): DataISO {
  return `${String(anno).padStart(4, "0")}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

/**
 * Come EDATE di Excel: stesso giorno N mesi dopo; se quel giorno non esiste
 * nel mese di arrivo si usa l'ultimo giorno del mese (31/01 + 1 mese = 28/02).
 */
export function aggiungiMesi(data: DataISO, mesi: number): DataISO {
  const [a, m, g] = parti(data);
  const totale = a * 12 + (m - 1) + mesi;
  const anno = Math.floor(totale / 12);
  const mese = (totale % 12) + 1;
  return componi(anno, mese, Math.min(g, giorniNelMese(anno, mese)));
}

export function aggiungiGiorni(data: DataISO, giorni: number): DataISO {
  const [a, m, g] = parti(data);
  const d = new Date(Date.UTC(a, m - 1, g + giorni));
  return componi(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Mesi (con decimali, come nel file di verifica) tra oggi e la scadenza. */
export function mesiResidui(oggi: DataISO, scadenza: DataISO): number {
  const [a1, m1, g1] = parti(oggi);
  const [a2, m2, g2] = parti(scadenza);
  return (a2 - a1) * 12 + (m2 - m1) + (g2 - g1) / 30;
}

// Festività nazionali italiane (per i giorni lavorativi di validità delle prenotazioni)
function pasqua(anno: number): DataISO {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31);
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return componi(anno, mese, giorno);
}

export function festivo(data: DataISO): boolean {
  const [a, m, g] = parti(data);
  const giornoSettimana = new Date(Date.UTC(a, m - 1, g)).getUTCDay();
  if (giornoSettimana === 0 || giornoSettimana === 6) return true;
  const md = data.slice(5);
  const fisse = ["01-01", "01-06", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"];
  if (fisse.includes(md)) return true;
  return data === aggiungiGiorni(pasqua(a), 1); // Lunedì dell'Angelo
}

/** Istante ISO di un orario di un giorno nel fuso di Roma (ora legale o solare). */
export function istanteRoma(data: DataISO, orario: string): string {
  const [a, m, g] = parti(data);
  const mezzogiorno = new Date(Date.UTC(a, m - 1, g, 12));
  const scarto = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", timeZoneName: "longOffset" })
    .formatToParts(mezzogiorno)
    .find((p) => p.type === "timeZoneName")!
    .value.replace("GMT", "");
  return new Date(`${data}T${orario}${scarto || "+00:00"}`).toISOString();
}

/** Fine della giornata (23:59:59) nel fuso di Roma. */
export function fineGiornoRoma(data: DataISO): string {
  return istanteRoma(data, "23:59:59");
}

/** Data dopo N giorni lavorativi (esclusi sabato, domenica e festività nazionali). */
export function aggiungiGiorniLavorativi(data: DataISO, giorni: number): DataISO {
  let d = data;
  let contati = 0;
  while (contati < giorni) {
    d = aggiungiGiorni(d, 1);
    if (!festivo(d)) contati++;
  }
  return d;
}
