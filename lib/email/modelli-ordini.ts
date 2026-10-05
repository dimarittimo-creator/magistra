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
  // Omaggi extra non a magazzino (es. espositori)
  const extra = o.omaggi_extra
    .map(
      (e) =>
        `<tr><td style="${cella}">Omaggio: ${esc(e.testo)}<br /><span style="color:#5a6a70;font-size:12px">Promozione «${esc(e.nome)}» · materiale promozionale</span></td>` +
        `<td style="${cellaDx}">${e.quantita}</td><td style="${cellaDx}"></td><td style="${cellaDx}"></td><td style="${cellaDx}">${formattaEuro(0)}</td></tr>`,
    )
    .join("");
  const iva = o.iva_dettaglio
    .map((d) => `<tr><td colspan="4" style="${cellaDx}">IVA ${d.aliquota.toLocaleString("it-IT")}% su ${formattaEuro(d.imponibileCent)}</td><td style="${cellaDx}">${formattaEuro(d.ivaCent)}</td></tr>`)
    .join("");
  const html =
    `<table style="width:100%;border-collapse:collapse;margin:0 0 18px"><thead><tr>` +
    `<th style="${cella}">Prodotto</th><th style="${cellaDx}">Q.tà</th><th style="${cellaDx}">Sconto</th><th style="${cellaDx}">Prezzo IVA escl.</th><th style="${cellaDx}">Imponibile</th>` +
    `</tr></thead><tbody>${righe}${extra}` +
    `<tr><td colspan="4" style="${cellaDx}"><strong>Imponibile</strong></td><td style="${cellaDx}"><strong>${formattaEuro(o.imponibile_cent)}</strong></td></tr>` +
    iva +
    `<tr><td colspan="4" style="${cellaDx}"><strong>Totale</strong></td><td style="${cellaDx}"><strong>${formattaEuro(o.totale_cent)}</strong></td></tr>` +
    `</tbody></table>`;
  const testo = [
    ...o.righe.map((r) => `- ${r.prodotto_nome} (lotto ${r.codice_lotto}, scad. ${formattaData(r.scadenza)}): ${r.quantita} × ${formattaEuro(r.prezzo_farmacia_netto_cent)} = ${formattaEuro(r.imponibile_cent)}`),
    ...o.omaggi_extra.map((e) => `- Omaggio: ${e.quantita} × ${e.testo} (promozione «${e.nome}»)`),
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

// ---------------------------------------------------------------------------
// Ordini dei privati: prezzi IVA inclusa, spese di spedizione su riga separata.
// ---------------------------------------------------------------------------

function tabellaPrivato(o: Ordine): Blocco {
  const righe = o.righe
    .map(
      (r) =>
        `<tr><td style="${cella}">${esc(r.prodotto_nome)}</td><td style="${cellaDx}">${r.quantita}</td>` +
        `<td style="${cellaDx}">${r.sconto_applicato > 0 ? `<s style="color:#5a6a70">${formattaEuro(r.prezzo_pubblico_cent)}</s> ` : ""}${formattaEuro(r.prezzo_farmacia_ivato_cent)}</td>` +
        `<td style="${cellaDx}">${formattaEuro(r.prezzo_farmacia_ivato_cent * r.quantita)}</td></tr>`,
    )
    .join("");
  const html =
    `<table style="width:100%;border-collapse:collapse;margin:0 0 18px"><thead><tr><th style="${cella}">Prodotto</th><th style="${cellaDx}">Q.tà</th><th style="${cellaDx}">Prezzo</th><th style="${cellaDx}">Totale</th></tr></thead><tbody>${righe}` +
    `<tr><td colspan="3" style="${cellaDx}">Spese di spedizione</td><td style="${cellaDx}">${o.spese_spedizione_cent ? formattaEuro(o.spese_spedizione_cent) : "gratuite"}</td></tr>` +
    `<tr><td colspan="3" style="${cellaDx}"><strong>Totale (IVA inclusa)</strong></td><td style="${cellaDx}"><strong>${formattaEuro(o.totale_cent)}</strong></td></tr></tbody></table>`;
  const testo = [
    ...o.righe.map((r) => `- ${r.prodotto_nome}: ${r.quantita} × ${formattaEuro(r.prezzo_farmacia_ivato_cent)}`),
    `Spese di spedizione ${formattaEuro(o.spese_spedizione_cent)} · Totale ${formattaEuro(o.totale_cent)} IVA inclusa`,
  ].join("\n");
  return { html, testo };
}

export function emailOrdinePrivatoRicevuto(o: Ordine, condizioni: { testo: string; versione: number }): Email {
  const c = o.snapshot_cliente;
  const p = o.snapshot_pagamento;
  const blocchi: Blocco[] = [
    `Ciao ${esc(c.nome ?? c.titolare)},`,
    `grazie! Abbiamo ricevuto il tuo ordine <strong>${o.numero}</strong> del ${formattaDataOra(o.creato_il)}. Ti scriveremo appena lo avremo confermato e quando partirà.`,
    tabellaPrivato(o),
    `<strong>Spedizione a:</strong> ${esc(formattaIndirizzoSnapshot(c.consegna))}<br />Consegna indicativa entro ${o.consegna_indicativa_giorni} giorni lavorativi dalla conferma.`,
  ];
  if (p.richiede_iban && p.iban) {
    blocchi.push(`<strong>Pagamento con bonifico:</strong> ${formattaEuro(o.totale_cent)} a ${esc(p.intestatario ?? o.snapshot_societa.ragione_sociale)}<br />IBAN ${formattaIban(p.iban)}<br />Causale: ordine ${o.numero}<br />Spediremo appena riceveremo il pagamento.`);
  } else {
    blocchi.push(`<strong>Pagamento:</strong> ${esc(p.descrizione)}${p.contrassegno ? ` – pagherai ${formattaEuro(o.totale_cent)} al corriere alla consegna` : ""}`);
  }
  blocchi.push(`<strong>Venditore:</strong> ${esc(o.snapshot_societa.ragione_sociale)} – ${esc(o.snapshot_societa.sede_legale)} – P.IVA ${esc(o.snapshot_societa.partita_iva)}`);
  blocchi.push({
    html: `<p style="font-size:13px;line-height:1.5;color:#5a6a70;margin:0 0 14px;white-space:pre-line"><strong>Condizioni di vendita accettate (versione ${condizioni.versione})</strong><br />${esc(condizioni.testo.replace(/\*\*/g, ""))}</p>`,
    testo: `Condizioni di vendita accettate (versione ${condizioni.versione}):\n${condizioni.testo.replace(/\*\*/g, "")}`,
  });
  return componi(c.email, `Magistra – Ordine ${o.numero} ricevuto`, blocchi, { testo: "Vedi il tuo ordine", url: `${sito()}/negozio/ordini/${o.id}` });
}

export function emailNuovoOrdinePrivatoAdmin(a: string[], o: Ordine): Email {
  const c = o.snapshot_cliente;
  return componi(
    a,
    `Magistra – Nuovo ordine privato ${o.numero} da ${c.ragione_sociale}`,
    [
      `Nuovo ordine <strong>${o.numero}</strong> dal cliente privato <strong>${esc(c.ragione_sociale)}</strong> (C.F. ${esc(c.codice_fiscale)}, ${esc(c.consegna?.citta ?? "")}).`,
      tabellaPrivato(o),
      datiSocieta(o),
      datiPagamento(o),
    ],
    { testo: "Apri l'ordine", url: `${sito()}/admin/ordini/${o.id}` },
  );
}

export type DatiSpedizioneEmail = { ddt_numero: string; ddt_data: string; corriere: string | null; tracking: string | null; colli: number | null; differenze: string[] };

const TESTI_STATO: Partial<Record<Ordine["stato"], (numero: string) => string>> = {
  in_verifica: (n) => `stiamo verificando la prenotazione <strong>${n}</strong>.`,
  confermato: (n) => `l'ordine <strong>${n}</strong> è <strong>confermato</strong>. Lo prepareremo e ti avviseremo alla spedizione.`,
  modificato: (n) => `l'ordine <strong>${n}</strong> è stato <strong>confermato con alcune modifiche</strong>: trovi qui sotto il riepilogo aggiornato.`,
  rifiutato: (n) => `purtroppo non possiamo accettare l'ordine <strong>${n}</strong>. La merce prenotata torna disponibile.`,
  inviato_deposito: (n) => `l'ordine <strong>${n}</strong> è stato trasmesso al deposito per la preparazione.`,
  in_preparazione: (n) => `il deposito sta preparando l'ordine <strong>${n}</strong>.`,
  spedito: (n) => `l'ordine <strong>${n}</strong> è stato <strong>spedito</strong>.`,
  consegnato: (n) => `l'ordine <strong>${n}</strong> risulta consegnato. Grazie!`,
};

/** Email alla farmacia a ogni cambio di stato, sempre con la società che fattura e consegna. */
export function emailCambioStato(o: Ordine, messaggio: string | null, spedizione?: DatiSpedizioneEmail): Email {
  const c = o.snapshot_cliente;
  const testo = TESTI_STATO[o.stato]?.(o.numero) ?? `l'ordine <strong>${o.numero}</strong> è ora nello stato «${o.stato}».`;
  const blocchi: Blocco[] = [o.canale === "privati" ? `Ciao ${esc(c.nome ?? c.titolare)},` : `Gentile ${esc(c.titolare)},`, testo];
  if (messaggio) blocchi.push(`<strong>Messaggio:</strong> ${esc(messaggio)}`);
  if (spedizione) {
    blocchi.push(
      `<strong>DDT n. ${esc(spedizione.ddt_numero)} del ${formattaData(spedizione.ddt_data)}</strong>` +
        (spedizione.corriere ? `<br />Corriere: ${esc(spedizione.corriere)}` : "") +
        (spedizione.tracking ? `<br />Tracking: ${esc(spedizione.tracking)}` : "") +
        (spedizione.colli ? `<br />Colli: ${spedizione.colli}` : ""),
    );
    if (spedizione.differenze.length) blocchi.push(`<strong>Differenze rispetto all'ordine:</strong><br />${spedizione.differenze.map(esc).join("<br />")}`);
    blocchi.push("Alla consegna controlla i colli e annota eventuali danni sul documento del corriere.");
  }
  if (o.stato === "modificato") blocchi.push(o.canale === "privati" ? tabellaPrivato(o) : tabellaRighe(o), datiPagamento(o));
  blocchi.push(datiSocieta(o));
  const oggetto: Partial<Record<Ordine["stato"], string>> = {
    confermato: "confermato",
    modificato: "confermato con modifiche",
    rifiutato: "non accettato",
    spedito: "spedito",
    consegnato: "consegnato",
    inviato_deposito: "in preparazione",
    in_preparazione: "in preparazione",
    in_verifica: "in verifica",
  };
  return componi(c.email, `Magistra – Ordine ${o.numero} ${oggetto[o.stato] ?? "aggiornato"}`, blocchi, {
    testo: "Vedi l'ordine",
    url: `${sito()}/${o.canale === "privati" ? "negozio" : "farmacia"}/ordini/${o.id}`,
  });
}

/** Richiesta di evasione al deposito: un file PDF + Excel per ogni ordine. */
export function emailRichiestaEvasione(
  destinatari: string[],
  cc: string[],
  deposito: string,
  ordini: Ordine[],
  allegati: NonNullable<Email["allegati"]>,
): Email {
  const elenco = ordini
    .map((o) => `${o.numero} – ${o.canale === "privati" ? "privato " : ""}${esc(o.snapshot_cliente.ragione_sociale)} (${esc(o.snapshot_cliente.consegna?.citta ?? "")}) – fattura ${esc(o.snapshot_societa.nome_breve)}${o.snapshot_pagamento.contrassegno ? ` – <strong>CONTRASSEGNO ${formattaEuro(o.totale_cent)}</strong>` : ""}`)
    .join("<br />");
  const email = componi(
    destinatari,
    ordini.length === 1 ? `Richiesta di evasione ordine ${ordini[0].numero}` : `Richiesta di evasione: ${ordini.length} ordini`,
    [
      `Buongiorno,`,
      `vi chiediamo di preparare e spedire ${ordini.length === 1 ? "l'ordine" : "gli ordini"} seguenti dal <strong>${esc(deposito)}</strong>. Per ogni ordine trovate in allegato il PDF e il file Excel con lotti e quantità da prelevare.`,
      elenco,
      "Sul DDT il mittente è la società indicata in ogni richiesta. Gli omaggi e lo sconto merce sono su righe separate (causale diversa).",
      "Grazie, il gruppo Sagè Pharma · Bioeleva",
    ],
  );
  return { ...email, cc, allegati };
}

export function emailSollecitoDdt(a: string[], ordini: { id: string; numero: string; farmacia: string; inviato: string; deposito: string }[]): Email {
  return componi(a, `Magistra – ${ordini.length} ordini senza DDT`, [
    "Questi ordini sono stati inviati al deposito ma non hanno ancora un DDT registrato:",
    ordini.map((o) => `<a href="${sito()}/admin/ordini/${o.id}">${o.numero}</a> – ${esc(o.farmacia)} – inviato il ${formattaDataOra(o.inviato)} a ${esc(o.deposito)}`).join("<br />"),
    "Verifica con il deposito e registra il DDT sull'ordine.",
  ]);
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
