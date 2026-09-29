// Lettura del listino (.xlsx), docs/IMPORT_EXCEL.md §2:
// A = codice minsan, B = nome, C = nome alternativo, D = prezzo al pubblico IVA inclusa.
// L'ultima riga "TOTALE" si ignora.

import ExcelJS from "exceljs";
import { normalizzaCodice } from "./giacenza";

export type VoceListino = { codice: string; nome: string; prezzo_pubblico_cent: number; riga: number };

export type ListinoLetto = { voci: VoceListino[]; errori: { riga: number; messaggio: string }[] };

function valoreCella(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === "object" && "result" in v) return v.result; // formula
  if (v && typeof v === "object" && "richText" in v) return v.richText.map((t) => t.text).join("");
  return v;
}

export async function leggiListino(contenuto: ArrayBuffer | Uint8Array, nomeFoglio?: string): Promise<ListinoLetto> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(contenuto as ArrayBuffer);
  const foglio = (nomeFoglio && wb.getWorksheet(nomeFoglio)) || wb.worksheets[0];
  const voci: VoceListino[] = [];
  const errori: ListinoLetto["errori"] = [];

  foglio.eachRow((row, numero) => {
    if (numero === 1) return; // intestazione
    const a = valoreCella(row.getCell(1).value);
    const b = valoreCella(row.getCell(2).value);
    const d = valoreCella(row.getCell(4).value);
    if (a == null && String(b ?? "").trim().toUpperCase() === "TOTALE") return;
    if (a == null && b == null) return;

    const codice = normalizzaCodice(a);
    if (!codice) {
      errori.push({ riga: numero, messaggio: `Codice prodotto non valido: «${a ?? ""}»` });
      return;
    }
    const prezzo = typeof d === "number" ? d : Number(String(d ?? "").replace(",", "."));
    if (!Number.isFinite(prezzo) || prezzo <= 0) {
      errori.push({ riga: numero, messaggio: `Prezzo mancante o non valido per ${codice}` });
      return;
    }
    voci.push({ codice, nome: String(b ?? "").trim(), prezzo_pubblico_cent: Math.round(prezzo * 100), riga: numero });
  });

  return { voci, errori };
}
