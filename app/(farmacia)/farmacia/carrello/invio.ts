"use server";

import { redirect } from "next/navigation";
import { richiediFarmaciaAttiva } from "@/lib/auth";
import { leggiRigheCarrello, verificaCarrello } from "@/lib/carrello";
import { caricaCatalogo } from "@/lib/catalogo";
import { aggiungiGiorniLavorativi, fineGiornoRoma } from "@/lib/date";
import { emailAmministrazione } from "@/lib/email/destinatari";
import { inviaEmail } from "@/lib/email/invia";
import { emailNuovoOrdineAdmin, emailPrenotazioneRicevuta } from "@/lib/email/modelli-ordini";
import { leggi } from "@/lib/farmacie/dati";
import { indirizzoDi, leggiFarmacia } from "@/lib/farmacie/lettura";
import { leggiOrdine, type SnapshotCliente, type SnapshotPagamento, type SnapshotSocieta } from "@/lib/ordini/lettura";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";
import { ibanValido } from "@/lib/validazione";

export type StatoInvio = {
  messaggio?: string;
  errori?: Record<string, string>;
  /** Righe da correggere: lotto → messaggio */
  righe?: Record<string, string>;
};

/**
 * Invio della prenotazione: ricontrolla tutto sul server (carrello, prezzi, società,
 * pagamento, condizioni) e poi impegna la merce in un'unica transazione nel database.
 */
export async function inviaPrenotazione(_prima: StatoInvio, fd: FormData): Promise<StatoInvio> {
  const utente = await richiediFarmaciaAttiva();
  const db = await creaClientServer();

  const errori: Record<string, string> = {};
  const societaId = leggi(fd, "societa_id");
  const pagamentoId = leggi(fd, "modalita_pagamento_id");
  const dataDesiderata = leggi(fd, "data_consegna_desiderata");
  const note = leggi(fd, "note").slice(0, 1000);
  const condizioniId = leggi(fd, "condizioni_documento_id");

  const [catalogo, salvate, farmacia, { data: societa }, { data: pagamento }, { data: condizioni }, { data: consentite }] = await Promise.all([
    caricaCatalogo(db, { farmaciaId: utente.farmaciaId }),
    leggiRigheCarrello(db, utente.farmaciaId),
    leggiFarmacia(db, utente.farmaciaId),
    societaId
      ? db.from("societa").select("*").eq("id", societaId).eq("attiva", true).eq("attiva_farmacie", true).maybeSingle()
      : Promise.resolve({ data: null }),
    pagamentoId
      ? db.from("modalita_pagamento").select("*").eq("id", pagamentoId).eq("attiva", true).in("canale", ["farmacie", "entrambi"]).maybeSingle()
      : Promise.resolve({ data: null }),
    db.rpc("documento_legale_corrente", { p_tipo: "condizioni_farmacie" }),
    db.rpc("modalita_consentite_farmacia", { p_farmacia: utente.farmaciaId }),
  ]);

  if (!societa) errori.societa_id = "Scegli la società che fattura e consegna";
  if (!pagamento) errori.modalita_pagamento_id = "Scegli la modalità di pagamento";
  else if (!((consentite ?? []) as string[]).includes(pagamento.id)) errori.modalita_pagamento_id = "Questa modalità di pagamento non è disponibile per la tua farmacia";
  if (pagamento?.richiede_iban && societa && !(societa.iban && ibanValido(societa.iban))) {
    errori.modalita_pagamento_id = `Il bonifico non è disponibile con ${societa.nome_breve}: scegli un'altra modalità`;
  }
  if (!fd.get("accetto_condizioni")) errori.accetto_condizioni = "Per inviare la prenotazione devi accettare le condizioni di vendita";
  else if (!condizioni?.id || condizioni.id !== condizioniId) {
    errori.accetto_condizioni = "Le condizioni di vendita sono state aggiornate: rileggile e accettale di nuovo";
  }
  if (dataDesiderata && (!/^\d{4}-\d{2}-\d{2}$/.test(dataDesiderata) || dataDesiderata <= catalogo.oggi)) {
    errori.data_consegna_desiderata = "La data desiderata deve essere successiva a oggi";
  }

  const carrello = verificaCarrello(catalogo, salvate);
  if (!carrello.inviabile) {
    return {
      errori,
      messaggio: carrello.problemiGenerali[0] ?? "Alcune righe del carrello vanno corrette prima dell'invio.",
    };
  }
  if (Object.keys(errori).length || !farmacia || !societa || !pagamento || !condizioni) {
    return { errori, messaggio: "Controlla i campi evidenziati." };
  }

  // Fotografia dei dati al momento dell'invio
  const snapshotCliente: SnapshotCliente = {
    tipo: "farmacia",
    ragione_sociale: farmacia.ragione_sociale,
    titolare: farmacia.titolare,
    partita_iva: farmacia.partita_iva,
    codice_fiscale: farmacia.codice_fiscale,
    codice_farmacia: farmacia.codice_farmacia,
    sdi: farmacia.sdi,
    pec: farmacia.pec,
    email: farmacia.email,
    telefono: farmacia.telefono,
    consegna: indirizzoDi(farmacia, "consegna") ?? null,
    fatturazione: indirizzoDi(farmacia, "fatturazione") ?? null,
  };
  const snapshotSocieta: SnapshotSocieta = {
    id: societa.id,
    codice: societa.codice,
    ragione_sociale: societa.ragione_sociale,
    nome_breve: societa.nome_breve,
    sede_legale: `${societa.sede_legale_indirizzo} – ${societa.sede_legale_cap} ${societa.sede_legale_citta} (${societa.sede_legale_provincia})`,
    partita_iva: societa.partita_iva,
    codice_fiscale: societa.codice_fiscale,
    sdi: societa.sdi,
    pec: societa.pec,
    rea: societa.rea,
    capitale_sociale_testo: societa.capitale_sociale_testo,
    sito: societa.sito,
    email: societa.email,
    telefono: societa.telefono,
    logo_path: societa.logo_path,
    piede_documenti: societa.piede_documenti,
  };
  const snapshotPagamento: SnapshotPagamento = {
    codice: pagamento.codice,
    descrizione: pagamento.descrizione,
    richiede_iban: pagamento.richiede_iban,
    contrassegno: pagamento.contrassegno,
    iban: pagamento.richiede_iban ? societa.iban : null,
    intestatario: pagamento.richiede_iban ? societa.ragione_sociale : null,
  };

  // Righe acquistate (con eventuali pezzi in sconto merce) e righe di solo omaggio a prezzo zero
  const righe = carrello.righe.map((r) => {
    const omaggio = r.omaggio !== null;
    return {
      lotto_id: r.lottoId,
      prodotto_codice: r.prodotto!.codice,
      prodotto_nome: omaggio ? `${r.prodotto!.nome} (omaggio)` : r.prodotto!.nome,
      codice_lotto: r.lotto!.codice_lotto,
      scadenza: r.lotto!.scadenza,
      quantita: r.quantita,
      quantita_omaggio: r.quantitaOmaggio,
      prezzo_pubblico_cent: r.lotto!.prezzi!.pubblicoIvatoCent,
      iva: r.prodotto!.iva,
      sconto_applicato: omaggio ? 100 : r.lotto!.sconto!.sconto,
      origine_sconto: omaggio ? "promozione" : r.lotto!.sconto!.origine,
      promozione_id: omaggio ? r.omaggio!.promozioneId : (r.lotto!.sconto!.promozioneId ?? r.promozioneMerceId ?? null),
      prezzo_pubblico_netto_cent: r.lotto!.prezzi!.pubblicoNettoCent,
      prezzo_farmacia_ivato_cent: omaggio ? 0 : r.lotto!.prezzi!.farmaciaIvatoCent,
      prezzo_farmacia_netto_cent: omaggio ? 0 : r.lotto!.prezzi!.farmaciaNettoCent,
      imponibile_cent: omaggio ? 0 : r.lotto!.prezzi!.farmaciaNettoCent * r.quantita,
    };
  });

  const scade = fineGiornoRoma(aggiungiGiorniLavorativi(catalogo.oggi, catalogo.impostazioni.giorni_validita_prenotazione));
  const admin = creaClientAdmin();
  const { data: esito, error } = await admin.rpc("invia_ordine_farmacia", {
    p_utente: utente.id,
    p_ordine: {
      societa_id: societa.id,
      deposito_id: carrello.depositoId,
      modalita_pagamento_id: pagamento.id,
      note,
      data_consegna_desiderata: dataDesiderata || null,
      consegna_indicativa_giorni: catalogo.impostazioni.giorni_consegna_indicativi,
      scade_il: scade,
      snapshot_cliente: snapshotCliente,
      snapshot_societa: snapshotSocieta,
      snapshot_pagamento: snapshotPagamento,
      condizioni_documento_id: condizioni.id,
      condizioni_versione: condizioni.versione,
      imponibile_cent: carrello.totali.imponibileCent,
      sconti_cent: carrello.totali.scontiCent,
      iva_cent: carrello.totali.ivaCent,
      iva_dettaglio: carrello.totali.ivaDettaglio,
      totale_cent: carrello.totali.totaleCent,
    },
    p_righe: righe,
  });

  if (error) {
    console.error("[ordine] invio non riuscito:", error.message);
    return { messaggio: "Invio non riuscito. Riprova tra poco; il carrello è rimasto com'era." };
  }
  if (esito.esito === "merce_insufficiente") {
    const perLotto: Record<string, string> = {};
    for (const r of esito.righe as { lotto_id: string; richiesta: number; disponibile: number }[]) {
      perLotto[r.lotto_id] = r.disponibile > 0 ? `Nel frattempo sono rimasti solo ${r.disponibile} pezzi: riduci la quantità` : "Nel frattempo questo lotto è stato prenotato da un'altra farmacia";
    }
    return { righe: perLotto, messaggio: "Nel frattempo parte della merce è stata prenotata: correggi le righe evidenziate e invia di nuovo." };
  }
  if (esito.esito !== "ok") return { messaggio: "La tua iscrizione non risulta attiva: contatta l'amministrazione." };

  // Omaggi extra non a magazzino (es. espositori): fotografia di quelli spettanti al momento dell'invio
  if (carrello.omaggiExtra.length) {
    const { error: errExtra } = await admin.from("ordini").update({ omaggi_extra: carrello.omaggiExtra }).eq("id", esito.ordine_id);
    if (errExtra) console.error("[ordine] omaggi extra non salvati:", errExtra.message);
  }

  // Email di conferma ricezione alla farmacia e avviso all'amministrazione
  const ordine = await leggiOrdine(admin, esito.ordine_id);
  if (ordine) {
    await Promise.all([
      inviaEmail(emailPrenotazioneRicevuta(ordine, { testo: condizioni.testo, versione: condizioni.versione })),
      emailAmministrazione().then((a) => inviaEmail(emailNuovoOrdineAdmin(a, ordine))),
    ]);
  }
  redirect(`/farmacia/ordini/${esito.ordine_id}?inviato=1`);
}
