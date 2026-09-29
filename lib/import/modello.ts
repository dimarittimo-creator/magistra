// Modello pulito di Magistra (docs/IMPORT_EXCEL.md §3): un foglio, una riga per lotto.
// Lo stesso formato si usa per l'export del magazzino.

import ExcelJS from "exceljs";
import type { DataISO } from "@/lib/date";
import { leggiScadenza, normalizzaCodice } from "./giacenza";

export const COLONNE_MODELLO = [
  "Codice",
  "Prodotto",
  "Formato",
  "Linea",
  "Area terapeutica",
  "Prezzo al pubblico IVA incl.",
  "IVA % (vuoto = predefinita)",
  "Visibile privati (sì/no)",
  "Deposito",
  "Lotto",
  "Scadenza (gg/mm/aaaa)",
  "Quantità lotto",
  "Giacenza totale prodotto",
  "Sconto lotto % (vuoto = fascia)",
] as const;

export type LottoModello = {
  deposito: string;
  codice_lotto: string;
  scadenza: DataISO | null;
  quantita: number;
  sconto_manuale: number | null;
  riga: number;
};

export type ProdottoModello = {
  codice: string;
  nome: string;
  formato: string | null;
  linea: string | null;
  area: string | null;
  prezzo_pubblico_cent: number | null;
  iva_override: number | null;
  visibile_privati: boolean;
  /** Giacenza totale dichiarata per deposito */
  totali: Record<string, number>;
  lotti: LottoModello[];
};

export type ModelloLetto = { prodotti: ProdottoModello[]; errori: { riga: number; messaggio: string }[] };

function valore(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === "object" && "result" in v) return v.result;
  if (v && typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("");
  if (v && typeof v === "object" && "text" in v) return (v as { text: string }).text;
  return v;
}

function numero(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", ".").replace("%", "").trim());
  return Number.isFinite(n) ? n : NaN;
}

function testo(v: unknown): string | null {
  const t = v == null ? "" : String(v).trim();
  return t || null;
}

export async function leggiModello(contenuto: ArrayBuffer | Uint8Array): Promise<ModelloLetto> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(contenuto as ArrayBuffer);
  const foglio = wb.worksheets[0];
  const prodotti = new Map<string, ProdottoModello>();
  const errori: ModelloLetto["errori"] = [];

  foglio.eachRow((row, n) => {
    if (n === 1) return;
    const c = (i: number) => valore(row.getCell(i).value);
    if (!c(1) && !c(10)) return; // riga vuota o legenda
    if (typeof c(1) === "string" && /^(legenda|esempio)/i.test(String(c(1)))) return;

    const codice = normalizzaCodice(c(1));
    if (!codice) return void errori.push({ riga: n, messaggio: `Codice non valido: «${c(1) ?? ""}»` });

    const prezzo = numero(c(6));
    const iva = numero(c(7));
    const quantita = numero(c(12));
    const totale = numero(c(13));
    const sconto = numero(c(14));
    const deposito = testo(c(9));
    const lotto = testo(c(10));
    if (Number.isNaN(prezzo) || (prezzo != null && prezzo <= 0)) errori.push({ riga: n, messaggio: `Prezzo non valido per ${codice}` });
    if (Number.isNaN(iva) || (iva != null && (iva < 0 || iva > 100))) errori.push({ riga: n, messaggio: `IVA non valida per ${codice}` });
    if (Number.isNaN(sconto) || (sconto != null && (sconto < 0 || sconto > 100))) errori.push({ riga: n, messaggio: `Sconto lotto non valido per ${codice}` });

    let p = prodotti.get(codice);
    if (!p) {
      const nome = testo(c(2));
      if (!nome) return void errori.push({ riga: n, messaggio: `Manca il nome del prodotto ${codice}` });
      p = {
        codice,
        nome,
        formato: testo(c(3)),
        linea: testo(c(4)),
        area: testo(c(5)),
        prezzo_pubblico_cent: prezzo == null || Number.isNaN(prezzo) ? null : Math.round(prezzo * 100),
        iva_override: iva == null || Number.isNaN(iva) ? null : iva,
        visibile_privati: /^s[iì]$/i.test(String(c(8) ?? "").trim()),
        totali: {},
        lotti: [],
      };
      prodotti.set(codice, p);
    }

    if (!lotto && !deposito) return; // prodotto senza lotti (solo anagrafica e prezzo)
    if (!deposito) return void errori.push({ riga: n, messaggio: `Manca il deposito del lotto ${lotto ?? ""} (${codice})` });
    if (!lotto) return void errori.push({ riga: n, messaggio: `Manca il codice lotto (${codice})` });
    if (quantita == null || Number.isNaN(quantita) || !Number.isInteger(quantita) || quantita < 0) {
      return void errori.push({ riga: n, messaggio: `Quantità del lotto ${lotto} non valida` });
    }
    if (totale != null && !Number.isNaN(totale)) p.totali[deposito] = totale;
    p.lotti.push({
      deposito,
      codice_lotto: lotto,
      scadenza: leggiScadenza(c(11)),
      quantita,
      sconto_manuale: sconto == null || Number.isNaN(sconto) ? null : sconto,
      riga: n,
    });
  });

  // Totale dichiarato mancante: si usa la somma dei lotti
  for (const p of prodotti.values()) {
    for (const dep of new Set(p.lotti.map((l) => l.deposito))) {
      if (p.totali[dep] == null) p.totali[dep] = p.lotti.filter((l) => l.deposito === dep).reduce((s, l) => s + l.quantita, 0);
    }
  }
  return { prodotti: [...prodotti.values()], errori };
}
