// Lettura della giacenza del deposito: export Crystal Reports (.xls), letto così com'è.
// Formato in docs/IMPORT_EXCEL.md §1:
//   Codice | Descrizione | Giacenza | LottoGiac. | Lotto | DataScadenza | Azienda produttrice
// prima riga lotto con il totale del prodotto in col. C, altre righe lotto con col. C vuota,
// riga di subtotale (A = differenza, B = somma lotti), ultima riga "Pagina -1 di 1".

import * as XLSX from "xlsx";
import type { DataISO } from "@/lib/date";

export type LottoLetto = { codice_lotto: string; scadenza: DataISO | null; quantita: number; riga: number };

export type ProdottoLetto = {
  codice: string;
  descrizione: string;
  totale_dichiarato: number;
  codice_interno: string | null;
  lotti: LottoLetto[];
  somma_lotti: number;
  difforme: boolean;
};

export type GiacenzaLetta = {
  prodotti: ProdottoLetto[];
  errori: { riga: number; messaggio: string }[];
  totali: { prodotti: number; lotti: number; pezzi: number; difformita: number; senza_scadenza: number };
};

/** Codice minsan a 9 cifre (i numeri perdono gli zeri iniziali: si ripristinano). */
export function normalizzaCodice(valore: unknown): string | null {
  if (valore == null || valore === "") return null;
  const testo = typeof valore === "number" ? String(Math.trunc(valore)) : String(valore).trim();
  if (!/^\d{1,9}$/.test(testo)) return null;
  return testo.padStart(9, "0");
}

/** Scadenza: numero di serie Excel, data o testo gg/mm/aaaa. Vuoto o solo orario = nessuna scadenza. */
export function leggiScadenza(valore: unknown): DataISO | null {
  if (valore == null || valore === "") return null;
  if (typeof valore === "number") {
    if (valore < 1) return null; // solo orario (00:00:00)
    const d = XLSX.SSF.parse_date_code(valore);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  if (valore instanceof Date) {
    return `${valore.getFullYear()}-${String(valore.getMonth() + 1).padStart(2, "0")}-${String(valore.getDate()).padStart(2, "0")}`;
  }
  const m = String(valore).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** Data della giacenza proposta dal nome del file (es. giacenza_21-09-2026.xls → 2026-09-21). */
export function dataDaNomeFile(nome: string): DataISO | null {
  const m = nome.match(/(\d{2})[-_.](\d{2})[-_.](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function leggiGiacenzaDeposito(contenuto: ArrayBuffer | Uint8Array): GiacenzaLetta {
  const wb = XLSX.read(contenuto, { type: "array" });
  const foglio = wb.Sheets[wb.SheetNames[0]];
  const righe = XLSX.utils.sheet_to_json<unknown[]>(foglio, { header: 1, raw: true, defval: null });

  const prodotti = new Map<string, ProdottoLetto>();
  const errori: GiacenzaLetta["errori"] = [];

  righe.forEach((r, i) => {
    const numeroRiga = i + 1;
    if (i === 0) return; // intestazione
    const [a, b, c, d, e, f, g] = r;
    if (typeof a === "string" && a.startsWith("Pagina")) return;
    const lotto = e == null ? "" : String(e);
    if (!lotto) return; // riga di subtotale o vuota

    const codice = normalizzaCodice(a);
    if (!codice) {
      errori.push({ riga: numeroRiga, messaggio: `Codice prodotto non valido: «${a ?? ""}»` });
      return;
    }
    const quantita = typeof d === "number" ? d : Number(d);
    if (!Number.isInteger(quantita) || quantita < 0) {
      errori.push({ riga: numeroRiga, messaggio: `Quantità del lotto ${lotto} non valida: «${d ?? ""}»` });
      return;
    }

    let prodotto = prodotti.get(codice);
    if (!prodotto) {
      if (typeof c !== "number") {
        errori.push({ riga: numeroRiga, messaggio: `Manca la giacenza totale del prodotto ${codice} sulla prima riga` });
        return;
      }
      prodotto = {
        codice,
        descrizione: String(b ?? "").trim(),
        totale_dichiarato: c,
        codice_interno: g == null ? null : String(g),
        lotti: [],
        somma_lotti: 0,
        difforme: false,
      };
      prodotti.set(codice, prodotto);
    }
    prodotto.lotti.push({ codice_lotto: lotto, scadenza: leggiScadenza(f), quantita, riga: numeroRiga });
    prodotto.somma_lotti += quantita;
  });

  const elenco = [...prodotti.values()];
  for (const p of elenco) p.difforme = p.somma_lotti !== p.totale_dichiarato;

  const lotti = elenco.flatMap((p) => p.lotti);
  return {
    prodotti: elenco,
    errori,
    totali: {
      prodotti: elenco.length,
      lotti: lotti.length,
      pezzi: lotti.reduce((s, l) => s + l.quantita, 0),
      difformita: elenco.filter((p) => p.difforme).length,
      senza_scadenza: lotti.filter((l) => !l.scadenza).length,
    },
  };
}
