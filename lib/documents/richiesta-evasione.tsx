import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import ExcelJS from "exceljs";
import { formattaData, formattaDataOra, formattaEuro } from "@/lib/formato";
import { formattaIndirizzoSnapshot, type Ordine } from "@/lib/ordini/lettura";

// Richiesta di evasione al deposito (docs/DEPOSITO_E_SPEDIZIONI.md §1), in PDF ed Excel.
// Formato standard proposto: da allineare al file che Sagè Pharma invia oggi al deposito.

export type DatiDeposito = {
  nome: string;
  indirizzo: string;
  operatore: string | null;
};

type Riga = { minsan: string; descrizione: string; lotto: string; scadenza: string; quantita: number; causale: "Vendita" | "Omaggio / sconto merce"; prezzo: number | null };

function righe(o: Ordine, conPrezzi: boolean): Riga[] {
  const out: Riga[] = [];
  for (const r of o.righe) {
    const base = { minsan: r.prodotto_codice, descrizione: r.prodotto_nome, lotto: r.codice_lotto, scadenza: formattaData(r.scadenza) };
    if (r.quantita > 0) out.push({ ...base, quantita: r.quantita, causale: "Vendita", prezzo: conPrezzi ? r.prezzo_farmacia_netto_cent : null });
    if (r.quantita_omaggio > 0) out.push({ ...base, quantita: r.quantita_omaggio, causale: "Omaggio / sconto merce", prezzo: conPrezzi ? 0 : null });
  }
  return out;
}

const BLU = "#022976";
const s = StyleSheet.create({
  pagina: { padding: 32, fontSize: 9, fontFamily: "Helvetica", color: "#1d2427" },
  titolo: { fontSize: 16, color: BLU, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  sottotitolo: { fontSize: 10, color: "#5a6a70", marginBottom: 14 },
  riquadri: { flexDirection: "row", gap: 10, marginBottom: 12 },
  riquadro: { flex: 1, borderWidth: 1, borderColor: "#dfe4e6", borderRadius: 4, padding: 8 },
  etichetta: { fontSize: 7, color: "#5a6a70", textTransform: "uppercase", marginBottom: 3 },
  grassetto: { fontFamily: "Helvetica-Bold" },
  tabella: { borderTopWidth: 1, borderColor: "#dfe4e6", marginTop: 6 },
  riga: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#dfe4e6", paddingVertical: 4 },
  intestazione: { backgroundColor: "#eceff0", fontFamily: "Helvetica-Bold" },
  evidenza: { marginTop: 10, padding: 8, borderWidth: 2, borderColor: "#d4200a", color: "#d4200a", fontFamily: "Helvetica-Bold", fontSize: 11 },
  piede: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 7, color: "#5a6a70", textAlign: "center" },
});
const col = { minsan: { width: "12%" }, desc: { width: "29%" }, lotto: { width: "17%", paddingRight: 4 }, scad: { width: "11%" }, qta: { width: "8%", textAlign: "right" as const }, causale: { width: "13%", paddingLeft: 6 }, prezzo: { width: "10%", textAlign: "right" as const } };

function RichiestaPdf({ o, deposito, conPrezzi }: { o: Ordine; deposito: DatiDeposito; conPrezzi: boolean }) {
  const c = o.snapshot_cliente;
  const soc = o.snapshot_societa;
  return (
    <Document title={`Richiesta di evasione ${o.numero}`} author="Magistra">
      <Page size="A4" style={s.pagina}>
        <Text style={s.titolo}>Richiesta di evasione – ordine {o.numero}</Text>
        <Text style={s.sottotitolo}>Ordine del {formattaDataOra(o.creato_il)} · canale {o.canale === "farmacie" ? "farmacia" : "privato"}</Text>

        <View style={s.riquadri}>
          <View style={s.riquadro}>
            <Text style={s.etichetta}>Mittente sul DDT (fattura e consegna)</Text>
            <Text style={s.grassetto}>{soc.ragione_sociale}</Text>
            <Text>{soc.sede_legale}</Text>
            <Text>P.IVA {soc.partita_iva}</Text>
          </View>
          <View style={s.riquadro}>
            <Text style={s.etichetta}>Deposito di partenza</Text>
            <Text style={s.grassetto}>{deposito.nome}</Text>
            <Text>{deposito.indirizzo}</Text>
            {deposito.operatore && <Text>Operatore: {deposito.operatore}</Text>}
          </View>
        </View>

        <View style={s.riquadri}>
          <View style={s.riquadro}>
            <Text style={s.etichetta}>Destinatario</Text>
            <Text style={s.grassetto}>{c.ragione_sociale}</Text>
            <Text>{o.canale === "privati" ? `Cliente privato · C.F. ${c.codice_fiscale}` : `Codice farmacia ${c.codice_farmacia} · P.IVA ${c.partita_iva}`}</Text>
            <Text>Consegna: {formattaIndirizzoSnapshot(c.consegna)}</Text>
            <Text>Telefono {c.telefono}</Text>
          </View>
          <View style={s.riquadro}>
            <Text style={s.etichetta}>Pagamento e consegna</Text>
            <Text style={s.grassetto}>{o.snapshot_pagamento.descrizione}</Text>
            {o.data_consegna_desiderata && <Text>Consegna desiderata: {formattaData(o.data_consegna_desiderata)}</Text>}
            {o.note && <Text>Note: {o.note}</Text>}
          </View>
        </View>

        <View style={s.tabella}>
          <View style={[s.riga, s.intestazione]}>
            <Text style={col.minsan}>Minsan</Text>
            <Text style={col.desc}>Descrizione</Text>
            <Text style={col.lotto}>Lotto</Text>
            <Text style={col.scad}>Scadenza</Text>
            <Text style={col.qta}>Q.tà</Text>
            <Text style={col.causale}>Causale</Text>
            {conPrezzi && <Text style={col.prezzo}>Prezzo netto</Text>}
          </View>
          {righe(o, conPrezzi).map((r, i) => (
            <View key={i} style={s.riga} wrap={false}>
              <Text style={col.minsan}>{r.minsan}</Text>
              <Text style={col.desc}>{r.descrizione}</Text>
              <Text style={[col.lotto, s.grassetto]}>{r.lotto}</Text>
              <Text style={col.scad}>{r.scadenza}</Text>
              <Text style={[col.qta, s.grassetto]}>{r.quantita}</Text>
              <Text style={col.causale}>{r.causale}</Text>
              {conPrezzi && <Text style={col.prezzo}>{r.prezzo == null ? "" : formattaEuro(r.prezzo)}</Text>}
            </View>
          ))}
        </View>

        {o.snapshot_pagamento.contrassegno && <Text style={s.evidenza}>CONTRASSEGNO: incassare {formattaEuro(o.totale_cent)} alla consegna</Text>}
        {conPrezzi && <Text style={{ marginTop: 8, textAlign: "right" }}>Imponibile {formattaEuro(o.imponibile_cent)} · IVA {formattaEuro(o.iva_cent)} · Totale {formattaEuro(o.totale_cent)}</Text>}

        <Text style={s.piede} fixed>Richiesta generata da Magistra – Semplicemente Magistrale · {soc.nome_breve} · documento non valido ai fini fiscali</Text>
      </Page>
    </Document>
  );
}

export async function pdfRichiestaEvasione(o: Ordine, deposito: DatiDeposito, conPrezzi: boolean): Promise<Buffer> {
  return renderToBuffer(<RichiestaPdf o={o} deposito={deposito} conPrezzi={conPrezzi} />);
}

export async function excelRichiestaEvasione(o: Ordine, deposito: DatiDeposito, conPrezzi: boolean): Promise<Buffer> {
  const c = o.snapshot_cliente;
  const soc = o.snapshot_societa;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Magistra";
  const ws = wb.addWorksheet(o.numero);
  ws.columns = [{ width: 14 }, { width: 40 }, { width: 14 }, { width: 13 }, { width: 10 }, { width: 22 }, { width: 14 }];
  const dati: [string, string][] = [
    ["Ordine", o.numero],
    ["Data ordine", formattaDataOra(o.creato_il)],
    ["Canale", o.canale === "farmacie" ? "Farmacia" : "Privato"],
    ["Mittente DDT (società)", `${soc.ragione_sociale} – P.IVA ${soc.partita_iva}`],
    ["Deposito di partenza", `${deposito.nome} – ${deposito.indirizzo}`],
    ["Destinatario", c.ragione_sociale],
    ...(o.canale === "privati"
      ? ([["Codice fiscale", c.codice_fiscale]] as [string, string][])
      : ([["Codice farmacia", c.codice_farmacia], ["Partita IVA", c.partita_iva]] as [string, string][])),
    ["Indirizzo di consegna", formattaIndirizzoSnapshot(c.consegna)],
    ["Telefono", c.telefono],
    ["Pagamento", o.snapshot_pagamento.descrizione],
    ["Contrassegno da incassare", o.snapshot_pagamento.contrassegno ? formattaEuro(o.totale_cent) : "—"],
    ["Consegna desiderata", o.data_consegna_desiderata ? formattaData(o.data_consegna_desiderata) : "—"],
    ["Note", o.note ?? ""],
  ];
  for (const [k, v] of dati) {
    const r = ws.addRow([k, v]);
    r.getCell(1).font = { bold: true };
    if (k.startsWith("Contrassegno") && o.snapshot_pagamento.contrassegno) r.getCell(2).font = { bold: true, color: { argb: "FFD4200A" } };
  }
  ws.addRow([]);
  const intest = ws.addRow(["Minsan", "Descrizione", "Lotto", "Scadenza", "Quantità", "Causale", ...(conPrezzi ? ["Prezzo netto"] : [])]);
  intest.font = { bold: true, color: { argb: "FFFFFFFF" } };
  intest.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF022976" } };
  for (const r of righe(o, conPrezzi)) {
    ws.addRow([r.minsan, r.descrizione, r.lotto, r.scadenza, r.quantita, r.causale, ...(conPrezzi ? [r.prezzo == null ? null : r.prezzo / 100] : [])]);
  }
  if (conPrezzi) ws.getColumn(7).numFmt = "#,##0.00 €";
  return Buffer.from(await wb.xlsx.writeBuffer());
}
