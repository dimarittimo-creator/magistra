import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { oggiRoma } from "@/lib/date";
import { autorizza, file, nonAutorizzato } from "@/lib/download";
import { leggiDdt, valoreDistribuito, type Filtri } from "@/lib/fatturazione";
import { formattaIndirizzoSnapshot } from "@/lib/ordini/lettura";
import { creaClientServer } from "@/lib/supabase/server";

// Export Excel dei DDT da fatturare: un foglio per DDT, uno per le righe, uno per il valore distribuito.
export async function GET(request: NextRequest) {
  if (!(await autorizza("admin"))) return nonAutorizzato();
  const q = request.nextUrl.searchParams;
  const stato = (["da_fatturare", "fatturati", "tutti"].includes(q.get("stato") ?? "") ? q.get("stato") : "da_fatturare") as Filtri["stato"];
  const db = await creaClientServer();
  const ddt = await leggiDdt(db, { societaId: q.get("societa") || null, canale: q.get("canale") || null, stato });
  const { data: sedi } = await db.from("sedi").select("id, nome");
  const nomeSede = new Map((sedi ?? []).map((s) => [s.id as string, s.nome as string]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Magistra";
  const intesta = (ws: ExcelJS.Worksheet) => {
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF022976" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };
  const data = (d: string) => new Date(`${d}T00:00:00Z`);

  const f1 = wb.addWorksheet("DDT");
  f1.columns = [
    { header: "Società emittente", width: 22 }, { header: "P.IVA società", width: 14 }, { header: "Canale", width: 10 },
    { header: "Ordine", width: 14 }, { header: "DDT n.", width: 12 }, { header: "Data DDT", width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Cliente", width: 34 }, { header: "P.IVA cliente", width: 14 }, { header: "Codice fiscale", width: 18 }, { header: "Codice farmacia", width: 12 },
    { header: "SDI", width: 10 }, { header: "PEC", width: 26 }, { header: "Indirizzo di fatturazione", width: 40 },
    { header: "Pagamento", width: 22 }, { header: "Scadenze RIBA", width: 14, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Imponibile", width: 12, style: { numFmt: "#,##0.00" } }, { header: "IVA", width: 10, style: { numFmt: "#,##0.00" } },
    { header: "Totale", width: 12, style: { numFmt: "#,##0.00" } }, { header: "Fatturato", width: 10 },
  ];
  for (const d of ddt) {
    f1.addRow([
      d.societa.ragione_sociale, d.societa.partita_iva, d.canale === "farmacie" ? "Farmacia" : "Privato", d.numeroOrdine, d.ddtNumero, data(d.ddtData),
      d.cliente.ragione_sociale, d.cliente.partita_iva, d.cliente.codice_fiscale, d.cliente.codice_farmacia, d.cliente.sdi ?? "", d.cliente.pec ?? "",
      formattaIndirizzoSnapshot(d.cliente.fatturazione), d.pagamento.descrizione, d.scadenzeRiba[0] ? data(d.scadenzeRiba[0]) : null,
      d.totali.imponibileCent / 100, d.totali.ivaCent / 100, d.totali.totaleCent / 100, d.fatturato ? "sì" : "no",
    ]);
  }
  intesta(f1);

  const f2 = wb.addWorksheet("Righe");
  f2.columns = [
    { header: "DDT n.", width: 12 }, { header: "Ordine", width: 14 }, { header: "Società", width: 16 }, { header: "Minsan", width: 12 },
    { header: "Prodotto", width: 34 }, { header: "Lotto", width: 12 }, { header: "Quantità", width: 10 }, { header: "Omaggio", width: 10 },
    { header: "Prezzo netto", width: 12, style: { numFmt: "#,##0.00" } }, { header: "IVA %", width: 8 }, { header: "Imponibile", width: 12, style: { numFmt: "#,##0.00" } },
  ];
  for (const d of ddt) {
    for (const r of d.righe) {
      f2.addRow([d.ddtNumero, d.numeroOrdine, d.societa.nome_breve, r.minsan, r.prodotto, r.lotto, r.quantita, r.omaggio, r.prezzoNettoCent / 100, r.iva, (r.prezzoNettoCent * r.quantita) / 100]);
    }
  }
  intesta(f2);

  const f3 = wb.addWorksheet("Valore distribuito");
  f3.columns = [{ header: "Mese", width: 10 }, { header: "Deposito", width: 22 }, { header: "Società", width: 16 }, { header: "DDT", width: 8 }, { header: "Imponibile", width: 14, style: { numFmt: "#,##0.00" } }];
  for (const v of valoreDistribuito(ddt)) f3.addRow([v.mese, nomeSede.get(v.depositoId) ?? "", v.societa, v.ddt, v.imponibileCent / 100]);
  intesta(f3);

  return file(Buffer.from(await wb.xlsx.writeBuffer()), `ddt-da-fatturare-${oggiRoma()}.xlsx`, "xlsx");
}
