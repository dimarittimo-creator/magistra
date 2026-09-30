import "server-only";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import ExcelJS from "exceljs";
import { formattaData, formattaDataOra, formattaEuro } from "@/lib/formato";
import { formattaIndirizzoSnapshot, type Ordine } from "@/lib/ordini/lettura";
import { ETICHETTE_STATO_ORDINE } from "@/lib/ordini/stati";
import { formattaIban } from "@/lib/validazione";

// Documenti dell'ordine per la farmacia (docs/FASI.md, Fase 4):
// - riepilogo d'ordine in PDF ed Excel con i dati fiscali di cliente e società che fattura;
// - DDT simulato: mittente = società scelta, luogo di partenza = deposito, condizioni di vendita
//   e la dicitura obbligatoria "Documento non valido ai fini fiscali – prenotazione non vincolante".
// Intestazione della società che fattura (logo, o segnaposto per Bioeleva); logo Magistra piccolo nel piè di pagina.
// Tutti gli importi sono quelli salvati nell'ordine: coincidono al centesimo con il riepilogo.

export const DICITURA_DDT = "Documento non valido ai fini fiscali – prenotazione non vincolante";

export type LuogoPartenza = { indirizzo: string };
export type Condizioni = { versione: number; testo: string };

// Niente sillabazione automatica: spezzerebbe email, codici e nomi di prodotto
Font.registerHyphenationCallback((parola) => [parola]);

const BLU = "#022976";
const GRIGIO = "#5a6a70";
const LINEA = "#dfe4e6";

/** Logo della società per i documenti: versione leggera se esiste, altrimenti null (segnaposto). */
function logoSocieta(percorso: string | null): Buffer | null {
  if (!percorso) return null;
  const base = join(process.cwd(), "public", percorso.replace(/^\//, ""));
  // Versione leggera per i documenti (es. logo-bioeleva-documenti.jpg), se esiste
  const leggeri = [".jpg", ".png"].map((est) => base.replace(/\.\w+$/, `-documenti${est}`));
  const file = leggeri.find((f) => existsSync(f)) ?? (existsSync(base) ? base : null);
  return file ? readFileSync(file) : null;
}

function logoMagistra(): Buffer | null {
  const file = join(process.cwd(), "public", "brand", "logo-magistra.png");
  return existsSync(file) ? readFileSync(file) : null;
}

const s = StyleSheet.create({
  pagina: { paddingTop: 28, paddingBottom: 56, paddingHorizontal: 32, fontSize: 8.5, fontFamily: "Helvetica", color: "#1d2427" },
  intestazione: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 1.5, borderColor: BLU, paddingBottom: 10, marginBottom: 12 },
  logo: { width: 170, height: 46, objectFit: "contain", objectPosition: "left" },
  segnaposto: { borderWidth: 1, borderColor: BLU, paddingVertical: 6, paddingHorizontal: 10, color: BLU, fontFamily: "Helvetica-Bold", fontSize: 13 },
  datiSocieta: { width: 250, textAlign: "right", fontSize: 7.5, color: GRIGIO, lineHeight: 1.35 },
  titolo: { fontSize: 15, color: BLU, fontFamily: "Helvetica-Bold" },
  sottotitolo: { fontSize: 9, color: GRIGIO, marginTop: 2, marginBottom: 10 },
  riquadri: { flexDirection: "row", gap: 8, marginBottom: 10 },
  riquadro: { flex: 1, borderWidth: 1, borderColor: LINEA, borderRadius: 3, padding: 7, gap: 1.5 },
  etichetta: { fontSize: 6.5, color: GRIGIO, textTransform: "uppercase", marginBottom: 3 },
  grassetto: { fontFamily: "Helvetica-Bold" },
  riga: { flexDirection: "row", borderBottomWidth: 0.7, borderColor: LINEA, paddingVertical: 3.5 },
  testata: { backgroundColor: "#eceff0", fontFamily: "Helvetica-Bold", fontSize: 7.5 },
  totali: { marginTop: 8, marginLeft: "auto", width: 230 },
  rigaTotale: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totale: { borderTopWidth: 1, borderColor: BLU, marginTop: 3, paddingTop: 4, fontFamily: "Helvetica-Bold", fontSize: 11, color: BLU },
  dicitura: { borderWidth: 2, borderColor: "#d4200a", color: "#d4200a", fontFamily: "Helvetica-Bold", fontSize: 10.5, textAlign: "center", padding: 6, marginBottom: 10 },
  condizioni: { marginTop: 12, fontSize: 7, color: GRIGIO, lineHeight: 1.4 },
  piede: { position: "absolute", bottom: 18, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 0.7, borderColor: LINEA, paddingTop: 5, fontSize: 6.5, color: GRIGIO },
  logoPiede: { width: 58, height: 17, objectFit: "contain" },
});

const col = {
  prodotto: { width: "25%" },
  lotto: { width: "13%", paddingRight: 3 },
  scad: { width: "9%" },
  qta: { width: "6%", textAlign: "right" as const },
  omaggio: { width: "7%", textAlign: "right" as const },
  pubblico: { width: "10%", textAlign: "right" as const },
  sconto: { width: "7%", textAlign: "right" as const },
  prezzo: { width: "10%", textAlign: "right" as const },
  iva: { width: "5%", textAlign: "right" as const },
  imponibile: { width: "12%", textAlign: "right" as const },
};

const pulisci = (t: string) => t.replace(/\*\*/g, "");

function Intestazione({ o }: { o: Ordine }) {
  const soc = o.snapshot_societa;
  const logo = logoSocieta(soc.logo_path);
  return (
    <View style={s.intestazione} fixed>
      {logo ? <Image src={logo} style={s.logo} /> : <Text style={s.segnaposto}>{soc.nome_breve}</Text>}
      <View style={s.datiSocieta}>
        <Text style={[s.grassetto, { color: "#1d2427", fontSize: 8.5 }]}>{soc.ragione_sociale}</Text>
        <Text>{soc.sede_legale}</Text>
        <Text>P.IVA {soc.partita_iva} · C.F. {soc.codice_fiscale}</Text>
        {(soc.rea || soc.capitale_sociale_testo) && (
          <Text>{[soc.rea && `REA ${soc.rea}`, soc.capitale_sociale_testo && `Capitale sociale ${soc.capitale_sociale_testo}`].filter(Boolean).join(" · ")}</Text>
        )}
        {(soc.pec || soc.sdi) && <Text>{[soc.pec && `PEC ${soc.pec}`, soc.sdi && `SDI ${soc.sdi}`].filter(Boolean).join(" · ")}</Text>}
        {soc.sito && <Text>{soc.sito}</Text>}
      </View>
    </View>
  );
}

function PiePagina({ o }: { o: Ordine }) {
  const logo = logoMagistra();
  return (
    <View style={s.piede} fixed>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {logo && <Image src={logo} style={s.logoPiede} />}
        <Text>Ordine effettuato tramite Magistra{o.snapshot_societa.piede_documenti ? ` · ${o.snapshot_societa.piede_documenti}` : ""}</Text>
      </View>
      <Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} di ${totalPages}`} />
    </View>
  );
}

function Cliente({ o, titolo }: { o: Ordine; titolo: string }) {
  const c = o.snapshot_cliente;
  return (
    <View style={s.riquadro}>
      <Text style={s.etichetta}>{titolo}</Text>
      <Text style={s.grassetto}>{c.ragione_sociale}</Text>
      <Text>P.IVA {c.partita_iva} · C.F. {c.codice_fiscale}</Text>
      <Text>Codice farmacia {c.codice_farmacia}</Text>
      {(c.sdi || c.pec) && <Text>{[c.sdi && `SDI ${c.sdi}`, c.pec && `PEC ${c.pec}`].filter(Boolean).join(" · ")}</Text>}
      <Text>Fatturazione: {formattaIndirizzoSnapshot(c.fatturazione)}</Text>
      <Text>Tel. {c.telefono} · {c.email}</Text>
    </View>
  );
}

function Righe({ o }: { o: Ordine }) {
  return (
    <View>
      <View style={[s.riga, s.testata]} fixed>
        <Text style={col.prodotto}>Prodotto</Text>
        <Text style={col.lotto}>Lotto</Text>
        <Text style={col.scad}>Scadenza</Text>
        <Text style={col.qta}>Q.tà</Text>
        <Text style={col.omaggio}>Omaggio</Text>
        <Text style={col.pubblico}>Pubblico IVA incl.</Text>
        <Text style={col.sconto}>Sconto</Text>
        <Text style={col.prezzo}>Prezzo IVA escl.</Text>
        <Text style={col.iva}>IVA</Text>
        <Text style={col.imponibile}>Imponibile</Text>
      </View>
      {o.righe.map((r) => (
        <View key={r.id} style={s.riga} wrap={false}>
          <View style={col.prodotto}>
            <Text>{r.prodotto_nome}</Text>
            <Text style={{ color: GRIGIO, fontSize: 7 }}>Minsan {r.prodotto_codice}</Text>
          </View>
          <Text style={col.lotto}>{r.codice_lotto}</Text>
          <Text style={col.scad}>{formattaData(r.scadenza)}</Text>
          <Text style={col.qta}>{r.quantita}</Text>
          <Text style={col.omaggio}>{r.quantita_omaggio || ""}</Text>
          <Text style={col.pubblico}>{formattaEuro(r.prezzo_pubblico_cent)}</Text>
          <Text style={col.sconto}>{`${r.sconto_applicato.toLocaleString("it-IT")}%`}</Text>
          <Text style={[col.prezzo, s.grassetto]}>{formattaEuro(r.prezzo_farmacia_netto_cent)}</Text>
          <Text style={col.iva}>{`${r.iva.toLocaleString("it-IT")}%`}</Text>
          <Text style={col.imponibile}>{formattaEuro(r.imponibile_cent)}</Text>
        </View>
      ))}
    </View>
  );
}

function Totali({ o }: { o: Ordine }) {
  return (
    <View style={s.totali} wrap={false}>
      {o.sconti_cent > 0 && (
        <View style={s.rigaTotale}>
          <Text>Sconti applicati (IVA esclusa)</Text>
          <Text>{formattaEuro(o.sconti_cent)}</Text>
        </View>
      )}
      <View style={s.rigaTotale}>
        <Text style={s.grassetto}>Imponibile</Text>
        <Text style={s.grassetto}>{formattaEuro(o.imponibile_cent)}</Text>
      </View>
      {o.iva_dettaglio.map((d) => (
        <View key={d.aliquota} style={s.rigaTotale}>
          <Text>{`IVA ${d.aliquota.toLocaleString("it-IT")}% su ${formattaEuro(d.imponibileCent)}`}</Text>
          <Text>{formattaEuro(d.ivaCent)}</Text>
        </View>
      ))}
      {o.spese_spedizione_cent > 0 && (
        <View style={s.rigaTotale}>
          <Text>Spese di spedizione</Text>
          <Text>{formattaEuro(o.spese_spedizione_cent)}</Text>
        </View>
      )}
      <View style={[s.rigaTotale, s.totale]}>
        <Text>Totale</Text>
        <Text>{formattaEuro(o.totale_cent)}</Text>
      </View>
    </View>
  );
}

function Pagamento({ o }: { o: Ordine }) {
  const p = o.snapshot_pagamento;
  return (
    <View style={s.riquadro}>
      <Text style={s.etichetta}>Pagamento</Text>
      <Text style={s.grassetto}>{p.descrizione}</Text>
      {p.richiede_iban && p.iban && (
        <>
          <Text>IBAN {formattaIban(p.iban)}</Text>
          <Text>Intestato a {p.intestatario ?? o.snapshot_societa.ragione_sociale} · causale: ordine {o.numero}</Text>
        </>
      )}
      {p.contrassegno && <Text style={s.grassetto}>Da pagare alla consegna: {formattaEuro(o.totale_cent)}</Text>}
    </View>
  );
}

function TestoCondizioni({ condizioni }: { condizioni: Condizioni | null }) {
  if (!condizioni) return null;
  return (
    <View style={s.condizioni}>
      <Text style={[s.grassetto, { color: "#1d2427", marginBottom: 2 }]}>Condizioni di vendita accettate (versione {condizioni.versione})</Text>
      {pulisci(condizioni.testo)
        .split(/\n\s*\n/)
        .map((p, i) => (
          <Text key={i} style={{ marginBottom: 2 }}>{p.replace(/\n/g, " ")}</Text>
        ))}
    </View>
  );
}

function RiepilogoOrdine({ o, condizioni }: { o: Ordine; condizioni: Condizioni | null }) {
  return (
    <Document title={`Ordine ${o.numero}`} author={o.snapshot_societa.ragione_sociale} creator="Magistra">
      <Page size="A4" style={s.pagina}>
        <Intestazione o={o} />
        <Text style={s.titolo}>Riepilogo ordine {o.numero}</Text>
        <Text style={s.sottotitolo}>
          Inviato il {formattaDataOra(o.creato_il)} · stato: {ETICHETTE_STATO_ORDINE[o.stato].testo}
          {o.stato === "inviato" || o.stato === "in_verifica" ? " · prenotazione non vincolante, in attesa di conferma" : ""}
        </Text>
        <View style={s.riquadri}>
          <Cliente o={o} titolo="Cliente" />
          <View style={s.riquadro}>
            <Text style={s.etichetta}>Consegna</Text>
            <Text>{formattaIndirizzoSnapshot(o.snapshot_cliente.consegna)}</Text>
            <Text>Consegna indicativa entro {o.consegna_indicativa_giorni} giorni lavorativi dalla conferma (non garantita)</Text>
            {o.data_consegna_desiderata && <Text>Data desiderata: {formattaData(o.data_consegna_desiderata)}</Text>}
            {o.note && <Text>Note: {o.note}</Text>}
          </View>
        </View>
        <Righe o={o} />
        <Totali o={o} />
        <View style={[s.riquadri, { marginTop: 10 }]}>
          <Pagamento o={o} />
        </View>
        <TestoCondizioni condizioni={condizioni} />
        <PiePagina o={o} />
      </Page>
    </Document>
  );
}

function DdtSimulato({ o, partenza, condizioni }: { o: Ordine; partenza: LuogoPartenza; condizioni: Condizioni | null }) {
  const c = o.snapshot_cliente;
  const soc = o.snapshot_societa;
  const colli = o.righe.reduce((n, r) => n + r.quantita + r.quantita_omaggio, 0);
  return (
    <Document title={`DDT simulato ${o.numero}`} author={soc.ragione_sociale} creator="Magistra">
      <Page size="A4" style={s.pagina}>
        <Intestazione o={o} />
        <Text style={s.dicitura}>{DICITURA_DDT.toUpperCase()}</Text>
        <Text style={s.titolo}>Documento di trasporto – simulazione</Text>
        <Text style={s.sottotitolo}>Riferimento ordine {o.numero} del {formattaData(o.creato_il)} · causale del trasporto: vendita</Text>
        <View style={s.riquadri}>
          <View style={s.riquadro}>
            <Text style={s.etichetta}>Mittente</Text>
            <Text style={s.grassetto}>{soc.ragione_sociale}</Text>
            <Text>{soc.sede_legale}</Text>
            <Text>P.IVA {soc.partita_iva}</Text>
          </View>
          <View style={s.riquadro}>
            <Text style={s.etichetta}>Luogo di partenza della merce</Text>
            <Text>{partenza.indirizzo}</Text>
          </View>
        </View>
        <View style={s.riquadri}>
          <Cliente o={o} titolo="Destinatario" />
          <View style={s.riquadro}>
            <Text style={s.etichetta}>Luogo di destinazione</Text>
            <Text style={s.grassetto}>{c.ragione_sociale}</Text>
            <Text>{formattaIndirizzoSnapshot(c.consegna)}</Text>
            <Text>Pezzi totali: {colli}</Text>
            {o.snapshot_pagamento.contrassegno && <Text style={s.grassetto}>Contrassegno: {formattaEuro(o.totale_cent)}</Text>}
          </View>
        </View>
        <Righe o={o} />
        <Totali o={o} />
        <View style={[s.riquadri, { marginTop: 10 }]}>
          <Pagamento o={o} />
        </View>
        <TestoCondizioni condizioni={condizioni} />
        <Text style={[s.dicitura, { marginTop: 12 }]}>{DICITURA_DDT}</Text>
        <PiePagina o={o} />
      </Page>
    </Document>
  );
}

export function pdfOrdine(o: Ordine, condizioni: Condizioni | null): Promise<Buffer> {
  return renderToBuffer(<RiepilogoOrdine o={o} condizioni={condizioni} />);
}

export function pdfDdtSimulato(o: Ordine, partenza: LuogoPartenza, condizioni: Condizioni | null): Promise<Buffer> {
  return renderToBuffer(<DdtSimulato o={o} partenza={partenza} condizioni={condizioni} />);
}

/** Excel dell'ordine: stessi dati e stessi totali del PDF e del riepilogo (valori, non formule). */
export async function excelOrdine(o: Ordine, condizioni: Condizioni | null): Promise<Buffer> {
  const c = o.snapshot_cliente;
  const soc = o.snapshot_societa;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Magistra";
  const ws = wb.addWorksheet(o.numero, { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 } });
  ws.columns = [{ width: 36 }, { width: 14 }, { width: 12 }, { width: 8 }, { width: 9 }, { width: 14 }, { width: 9 }, { width: 14 }, { width: 7 }, { width: 14 }];
  const euro = "#,##0.00 €";

  const titolo = ws.addRow([`Ordine ${o.numero}`]);
  titolo.font = { bold: true, size: 14, color: { argb: "FF022976" } };
  ws.addRow([`Inviato il ${formattaDataOra(o.creato_il)} · stato: ${ETICHETTE_STATO_ORDINE[o.stato].testo}`]).font = { color: { argb: "FF5A6A70" } };
  ws.addRow([]);

  const blocco = (nome: string, righe: [string, string][]) => {
    ws.addRow([nome]).font = { bold: true, color: { argb: "FF022976" } };
    for (const [k, v] of righe) {
      const r = ws.addRow([k, v]);
      r.getCell(1).font = { color: { argb: "FF5A6A70" } };
      ws.mergeCells(r.number, 2, r.number, 10);
    }
    ws.addRow([]);
  };
  blocco("Società che fattura e consegna", [
    ["Ragione sociale", soc.ragione_sociale],
    ["Sede legale", soc.sede_legale],
    ["P.IVA / C.F.", `${soc.partita_iva} / ${soc.codice_fiscale}`],
    ["REA / Capitale sociale", [soc.rea, soc.capitale_sociale_testo].filter(Boolean).join(" · ")],
    ["PEC / SDI", [soc.pec, soc.sdi].filter(Boolean).join(" · ")],
  ]);
  blocco("Cliente", [
    ["Ragione sociale", c.ragione_sociale],
    ["P.IVA / C.F.", `${c.partita_iva} / ${c.codice_fiscale}`],
    ["Codice farmacia", c.codice_farmacia],
    ["SDI / PEC", [c.sdi, c.pec].filter(Boolean).join(" · ")],
    ["Indirizzo di fatturazione", formattaIndirizzoSnapshot(c.fatturazione)],
    ["Indirizzo di consegna", formattaIndirizzoSnapshot(c.consegna)],
    ["Telefono / email", `${c.telefono} · ${c.email}`],
  ]);
  const pagamento = o.snapshot_pagamento;
  blocco("Pagamento e consegna", [
    ["Modalità di pagamento", pagamento.descrizione],
    ...(pagamento.richiede_iban && pagamento.iban ? ([["IBAN", `${formattaIban(pagamento.iban)} – ${pagamento.intestatario ?? soc.ragione_sociale}`]] as [string, string][]) : []),
    ["Consegna indicativa", `entro ${o.consegna_indicativa_giorni} giorni lavorativi dalla conferma (non garantita)`],
    ...(o.data_consegna_desiderata ? ([["Data desiderata", formattaData(o.data_consegna_desiderata)]] as [string, string][]) : []),
    ...(o.note ? ([["Note", o.note]] as [string, string][]) : []),
  ]);

  const intest = ws.addRow(["Prodotto", "Minsan", "Lotto", "Q.tà", "Omaggio", "Pubblico IVA incl.", "Sconto %", "Prezzo IVA escl.", "IVA %", "Imponibile"]);
  intest.font = { bold: true, color: { argb: "FFFFFFFF" } };
  intest.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF022976" } };
  for (const r of o.righe) {
    const riga = ws.addRow([
      `${r.prodotto_nome} (scad. ${formattaData(r.scadenza)})`,
      r.prodotto_codice,
      r.codice_lotto,
      r.quantita,
      r.quantita_omaggio || null,
      r.prezzo_pubblico_cent / 100,
      r.sconto_applicato,
      r.prezzo_farmacia_netto_cent / 100,
      r.iva,
      r.imponibile_cent / 100,
    ]);
    for (const n of [6, 8, 10]) riga.getCell(n).numFmt = euro;
  }
  ws.addRow([]);
  const totale = (etichetta: string, cent: number, grassetto = false) => {
    const r = ws.addRow([]);
    r.getCell(8).value = etichetta;
    r.getCell(10).value = cent / 100;
    r.getCell(10).numFmt = euro;
    if (grassetto) r.font = { bold: true };
  };
  if (o.sconti_cent > 0) totale("Sconti applicati", o.sconti_cent);
  totale("Imponibile", o.imponibile_cent, true);
  for (const d of o.iva_dettaglio) totale(`IVA ${d.aliquota.toLocaleString("it-IT")}%`, d.ivaCent);
  if (o.spese_spedizione_cent > 0) totale("Spese di spedizione", o.spese_spedizione_cent);
  totale("Totale", o.totale_cent, true);

  if (condizioni) {
    ws.addRow([]);
    ws.addRow([`Condizioni di vendita accettate (versione ${condizioni.versione})`]).font = { bold: true };
    for (const p of pulisci(condizioni.testo).split(/\n\s*\n/)) {
      const r = ws.addRow([p.replace(/\n/g, " ")]);
      ws.mergeCells(r.number, 1, r.number, 10);
      r.alignment = { wrapText: true, vertical: "top" };
      r.height = Math.min(15 * Math.ceil(p.length / 140), 90);
    }
  }
  ws.addRow([]);
  ws.addRow([`Ordine effettuato tramite Magistra – ${soc.ragione_sociale}`]).font = { italic: true, color: { argb: "FF5A6A70" } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

