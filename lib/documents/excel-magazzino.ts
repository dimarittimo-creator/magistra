import "server-only";
import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COLONNE_MODELLO } from "@/lib/import/modello";

// Export del magazzino e modello vuoto, nel formato del "modello pulito" (docs/IMPORT_EXCEL.md §3):
// il file esportato si può correggere e ricaricare così com'è.

const BLU = "FF022976";

function preparaFoglio(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("Magazzino", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLONNE_MODELLO.map((c, i) => ({
    header: c,
    width: [12, 34, 14, 16, 18, 14, 12, 12, 20, 14, 14, 12, 14, 14][i],
  }));
  const intestazione = ws.getRow(1);
  intestazione.font = { bold: true, color: { argb: "FFFFFFFF" } };
  intestazione.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLU } };
  intestazione.alignment = { wrapText: true, vertical: "middle" };
  intestazione.height = 32;
  ws.getColumn(6).numFmt = "#,##0.00";
  ws.getColumn(11).numFmt = "dd/mm/yyyy";
  return ws;
}

function aggiungiLegenda(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("Legenda");
  ws.columns = [{ width: 32 }, { width: 90 }];
  const righe: [string, string][] = [
    ["Come si usa", "Una riga per lotto. Per un prodotto senza lotti lascia vuote le colonne da Deposito in poi."],
    ["Codice", "Minsan a 9 cifre."],
    ["Prezzo al pubblico IVA incl.", "In euro, con la virgola. Vuoto = prodotto non visibile alle farmacie."],
    ["IVA %", "Vuoto = aliquota predefinita del portale (oggi 10%)."],
    ["Visibile privati", "sì / no."],
    ["Deposito", "Nome del deposito come in Amministrazione → Sedi e depositi (es. Deposito CIENNE)."],
    ["Scadenza", "gg/mm/aaaa. Vuota = lotto «Mancante»."],
    ["Giacenza totale prodotto", "Totale dichiarato per prodotto e deposito. Se non coincide con la somma dei lotti il prodotto è «Mancante temporaneamente»."],
    ["Sconto lotto %", "Vuoto = sconto della fascia di scadenza. Un valore sostituisce la fascia per quel lotto."],
    ["Attenzione", "Per i prodotti presenti nel file, i lotti non elencati vanno a giacenza 0 in quel deposito."],
  ];
  for (const r of righe) ws.addRow(r).getCell(1).font = { bold: true };
}

export async function excelMagazzino(db: SupabaseClient): Promise<Buffer> {
  const [{ data: prodotti }, { data: lotti }, { data: giacenze }, { data: sedi }] = await Promise.all([
    db.from("prodotti").select("codice, nome, formato, prezzo_pubblico_cent, iva_override, visibile_privati, linea:linea_id(nome), area:area_id(nome)").order("nome"),
    db.from("lotti").select("prodotto_codice, deposito_id, codice_lotto, scadenza, giacenza, sconto_manuale").gt("giacenza", 0).order("scadenza"),
    db.from("giacenze_prodotto").select("prodotto_codice, deposito_id, totale_dichiarato"),
    db.from("sedi").select("id, nome"),
  ]);
  const nomeSede = new Map((sedi ?? []).map((s) => [s.id as string, s.nome as string]));
  const totale = new Map((giacenze ?? []).map((g) => [`${g.prodotto_codice}|${g.deposito_id}`, g.totale_dichiarato as number]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Magistra";
  const ws = preparaFoglio(wb);
  for (const p of (prodotti ?? []) as unknown as {
    codice: string;
    nome: string;
    formato: string | null;
    prezzo_pubblico_cent: number | null;
    iva_override: number | null;
    visibile_privati: boolean;
    linea: { nome: string } | null;
    area: { nome: string } | null;
  }[]) {
    const base = [
      p.codice,
      p.nome,
      p.formato ?? "",
      p.linea?.nome ?? "",
      p.area?.nome ?? "",
      p.prezzo_pubblico_cent == null ? null : p.prezzo_pubblico_cent / 100,
      p.iva_override == null ? null : Number(p.iva_override),
      p.visibile_privati ? "sì" : "no",
    ];
    const suoi = (lotti ?? []).filter((l) => l.prodotto_codice === p.codice);
    if (!suoi.length) {
      ws.addRow(base);
      continue;
    }
    for (const l of suoi) {
      ws.addRow([
        ...base,
        nomeSede.get(l.deposito_id) ?? "",
        l.codice_lotto,
        l.scadenza ? new Date(`${l.scadenza}T00:00:00Z`) : null,
        l.giacenza,
        totale.get(`${p.codice}|${l.deposito_id}`) ?? null,
        l.sconto_manuale == null ? null : Number(l.sconto_manuale),
      ]);
    }
  }
  aggiungiLegenda(wb);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function excelModelloVuoto(nomeDeposito: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Magistra";
  const ws = preparaFoglio(wb);
  const esempio = ws.addRow(["983389420", "ADEGEN Bustine", "10 bustine", "Linea esempio", "Area esempio", 22.5, null, "no", nomeDeposito, "L-03", new Date("2027-12-31T00:00:00Z"), 616, 616, null]);
  esempio.font = { italic: true, color: { argb: "FF5A6A70" } };
  aggiungiLegenda(wb);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
