import { formattaData, formattaDataOra, formattaEuro } from "@/lib/formato";
import { formattaIndirizzoSnapshot, type Ordine } from "@/lib/ordini/lettura";
import { formattaIban } from "@/lib/validazione";
import type { Email } from "./invia";
import { componi, esc, sito, type Blocco } from "./modelli";

// Email degli ordini: riepilogo con la società che fattura e consegna, pagamento
// (con IBAN per il bonifico), consegna indicativa e condizioni di vendita accettate.

const cella = "padding:6px 8px;border-bottom:1px solid #dfe4e6;font-size:14px;text-align:left";
const cellaDx = `${cella};text-align:right;white-space:nowrap`;

function tabellaRighe(o: Ordine): Blocco {
  const righe = o.righe
    .map(
      (r) =>
        `<tr><td style="${cella}">${esc(r.prodotto_nome)}<br /><span style="color:#5a6a70;font-size:12px">Minsan ${r.prodotto_codice} · lotto ${esc(r.codice_lotto)} · scad. ${formattaData(r.scadenza)}</span></td>` +
        `<td style="${cellaDx}">${r.quantita}</td><td style="${cellaDx}">−${r.sconto_applicato.toLocaleString("it-IT")}%</td>` +
        `<td style="${cellaDx}">${formattaEuro(r.prezzo_farmacia_netto_cent)}</td><td style="${cellaDx}">${formattaEuro(r.imponibile_cent)}</td></tr>`,
    )
    .join("");
  const iva = o.iva_dettaglio
    .map((d) => `<tr><td colspan="4" style="${cellaDx}">IVA ${d.aliquota.toLocaleString("it-IT")}% su ${formattaEuro(d.imponibileCent)}</td><td style="${cellaDx}">${formattaEuro(d.ivaCent)}</td></tr>`)
    .join("");
  const html =
    `<table style="width:100%;border-collapse:collapse;margin:0 0 18px"><thead><tr>` +
    `<th style="${cella}">Prodotto</th><th style="${cellaDx}">Q.tà</th><th style="${cellaDx}">Sconto</th><th style="${cellaDx}">Prezzo IVA escl.</th><th style="${cellaDx}">Imponibile</th>` +
    `</tr></thead><tbody>${righe}` +
    `<tr><td colspan="4" style="${cellaDx}"><strong>Imponibile</strong></td><td style="${cellaDx}"><strong>${formattaEuro(o.imponibile_cent)}</strong></td></tr>` +
    iva +
    `<tr><td colspan="4" style="${cellaDx}"><strong>Totale</strong></td><td style="${cellaDx}"><strong>${formattaEuro(o.totale_cent)}</strong></td></tr>` +
    `</tbody></table>`;
  const testo = [
    ...o.righe.map((r) => `- ${r.prodotto_nome} (lotto ${r.codice_lotto}, scad. ${formattaData(r.scadenza)}): ${r.quantita} × ${formattaEuro(r.prezzo_farmacia_netto_cent)} = ${formattaEuro(r.imponibile_cent)}`),
    `Imponibile ${formattaEuro(o.imponibile_cent)} · IVA ${formattaEuro(o.iva_cent)} · Totale ${formattaEuro(o.totale_cent)}`,
  ].join("\n");
  return { html, testo };
}

function datiSocieta(o: Ordine): string {
  const s = o.snapshot_societa;
  return `<strong>Fattura e consegna:</strong> ${esc(s.ragione_sociale)}<br />${esc(s.sede_legale)}<br />P.IVA ${esc(s.partita_iva)}${s.pec ? ` · PEC ${esc(s.pec)}` : ""}`;
}

function datiPagamento(o: Ordine): string {
  const p = o.snapshot_pagamento;
  let t = `<strong>Pagamento:</strong> ${esc(p.descrizione)}`;
  if (p.richiede_iban && p.iban) t += `<br />IBAN ${formattaIban(p.iban)} intestato a ${esc(p.intestatario ?? o.snapshot_societa.ragione_sociale)}<br />Causale: ordine ${o.numero}`;
  if (p.contrassegno) t += `<br />Importo da pagare alla consegna: <strong>${formattaEuro(o.totale_cent)}</strong>`;
  return t;
}

function datiConsegna(o: Ordine): string {
  let t = `<strong>Consegna a:</strong> ${esc(formattaIndirizzoSnapshot(o.snapshot_cliente.consegna))}<br />Consegna indicativa entro ${o.consegna_indicativa_giorni} giorni lavorativi dalla conferma (termine non garantito).`;
  if (o.data_consegna_desiderata) t += `<br />Data desiderata: ${formattaData(o.data_consegna_desiderata)}`;
  if (o.note) t += `<br />Note: ${esc(o.note)}`;
  return t;
}

export function emailPrenotazioneRicevuta(o: Ordine, condizioni: { testo: string; versione: number }): Email {
  const c = o.snapshot_cliente;
  const clausole = condizioni.testo.replace(/\*\*/g, "");
  return componi(
    c.email,
    `Magistra – Prenotazione ${o.numero} ricevuta`,
    [
      `Gentile ${esc(c.titolare)},`,
      `abbiamo ricevuto la prenotazione d'ordine <strong>${o.numero}</strong> del ${formattaDataOra(o.creato_il)} per <strong>${esc(c.ragione_sociale)}</strong>.`,
      `<strong>È una prenotazione non vincolante:</strong> l'ordine diventa definitivo solo dopo la nostra conferma, che riceverai via email.${o.scade_il ? ` Se non confermata entro il ${formattaDataOra(o.scade_il)} la prenotazione scade e la merce torna disponibile.` : ""}`,
      tabellaRighe(o),
      datiSocieta(o),
      datiPagamento(o),
      datiConsegna(o),
      "Alla consegna controlla i colli e annota eventuali danni sul documento del corriere.",
      {
        html: `<p style="font-size:13px;line-height:1.5;color:#5a6a70;margin:0 0 14px;white-space:pre-line"><strong>Condizioni di vendita accettate (versione ${condizioni.versione})</strong><br />${esc(clausole)}</p>`,
        testo: `Condizioni di vendita accettate (versione ${condizioni.versione}):\n${clausole}`,
      },
    ],
    { testo: "Vedi la prenotazione", url: `${sito()}/farmacia/ordini/${o.id}` },
  );
}

export function emailNuovoOrdineAdmin(a: string[], o: Ordine): Email {
  const c = o.snapshot_cliente;
  return componi(
    a,
    `Magistra – Nuova prenotazione ${o.numero} da ${c.ragione_sociale}`,
    [
      `Nuova prenotazione <strong>${o.numero}</strong> da <strong>${esc(c.ragione_sociale)}</strong> (codice ${esc(c.codice_farmacia)}, ${esc(c.consegna?.citta ?? "")}).`,
      tabellaRighe(o),
      datiSocieta(o),
      datiPagamento(o),
      datiConsegna(o),
      o.scade_il ? `Da confermare entro il ${formattaDataOra(o.scade_il)}, poi scade e la merce torna disponibile.` : "",
    ].filter(Boolean),
    { testo: "Apri la prenotazione", url: `${sito()}/admin/ordini/${o.id}` },
  );
}

export function emailPrenotazioneScaduta(o: Pick<Ordine, "id" | "numero" | "snapshot_cliente">): Email {
  const c = o.snapshot_cliente;
  return componi(
    c.email,
    `Magistra – Prenotazione ${o.numero} scaduta`,
    [
      `Gentile ${esc(c.titolare)},`,
      `la prenotazione <strong>${o.numero}</strong> non è stata confermata entro i termini ed è scaduta: la merce è tornata disponibile.`,
      "Se ti serve ancora puoi ripeterla con un clic dalla pagina «I miei ordini».",
    ],
    { testo: "Vai ai miei ordini", url: `${sito()}/farmacia/ordini/${o.id}` },
  );
}
