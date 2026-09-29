import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { oggiRoma } from "@/lib/date";
import { autorizza, file, nonAutorizzato } from "@/lib/download";
import type { SnapshotCliente, SnapshotPagamento, SnapshotSocieta } from "@/lib/ordini/lettura";
import { ETICHETTE_STATO_ORDINE, type StatoOrdine } from "@/lib/ordini/stati";
import { creaClientServer } from "@/lib/supabase/server";

// Export Excel dell'elenco ordini (con il filtro per stato della pagina).
export async function GET(request: NextRequest) {
  if (!(await autorizza("admin", "operatore"))) return nonAutorizzato();
  const stato = request.nextUrl.searchParams.get("stato");
  const db = await creaClientServer();
  let q = db
    .from("ordini")
    .select("numero, canale, stato, creato_il, snapshot_cliente, snapshot_societa, snapshot_pagamento, imponibile_cent, iva_cent, totale_cent, data_consegna_desiderata, note")
    .order("creato_il", { ascending: false })
    .limit(5000);
  if (stato && stato in ETICHETTE_STATO_ORDINE) q = q.eq("stato", stato);
  const { data } = await q;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Magistra";
  const ws = wb.addWorksheet("Ordini", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Numero", width: 14 }, { header: "Data", width: 16, style: { numFmt: "dd/mm/yyyy hh:mm" } }, { header: "Stato", width: 18 },
    { header: "Canale", width: 10 }, { header: "Cliente", width: 34 }, { header: "Codice farmacia", width: 12 }, { header: "P.IVA", width: 14 },
    { header: "Città", width: 16 }, { header: "Fattura", width: 14 }, { header: "Pagamento", width: 22 },
    { header: "Imponibile", width: 12, style: { numFmt: "#,##0.00" } }, { header: "IVA", width: 10, style: { numFmt: "#,##0.00" } },
    { header: "Totale", width: 12, style: { numFmt: "#,##0.00" } }, { header: "Consegna desiderata", width: 14, style: { numFmt: "dd/mm/yyyy" } }, { header: "Note", width: 30 },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF022976" } };
  for (const o of data ?? []) {
    const c = o.snapshot_cliente as SnapshotCliente;
    ws.addRow([
      o.numero, new Date(o.creato_il), ETICHETTE_STATO_ORDINE[o.stato as StatoOrdine].testo, o.canale === "farmacie" ? "Farmacia" : "Privato",
      c.ragione_sociale, c.codice_farmacia, c.partita_iva, c.consegna?.citta ?? "", (o.snapshot_societa as SnapshotSocieta).nome_breve,
      (o.snapshot_pagamento as SnapshotPagamento).descrizione, o.imponibile_cent / 100, o.iva_cent / 100, o.totale_cent / 100,
      o.data_consegna_desiderata ? new Date(`${o.data_consegna_desiderata}T00:00:00Z`) : null, o.note ?? "",
    ]);
  }
  return file(Buffer.from(await wb.xlsx.writeBuffer()), `ordini-magistra-${oggiRoma()}.xlsx`, "xlsx");
}
