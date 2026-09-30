"use server";

import { redirect } from "next/navigation";
import { richiediPrivato } from "@/lib/auth";
import { emailAmministrazione } from "@/lib/email/destinatari";
import { inviaEmail } from "@/lib/email/invia";
import { emailNuovoOrdinePrivatoAdmin, emailOrdinePrivatoRicevuto } from "@/lib/email/modelli-ordini";
import { leggi } from "@/lib/farmacie/dati";
import { caricaNegozio } from "@/lib/negozio";
import { leggiOrdine, type SnapshotCliente, type SnapshotPagamento, type SnapshotSocieta } from "@/lib/ordini/lettura";
import { scorporaIva } from "@/lib/pricing";
import { leggiCarrelloPrivato, leggiRegolaSpese, verificaCarrelloPrivato } from "@/lib/privati/carrello";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";
import { ibanValido } from "@/lib/validazione";

export type StatoInvioPrivato = { messaggio?: string; errori?: Record<string, string> };

/** Invio dell'ordine del privato: ricontrolla tutto sul server e impegna la merce in un'unica transazione. */
export async function inviaOrdinePrivato(_prima: StatoInvioPrivato, fd: FormData): Promise<StatoInvioPrivato> {
  const utente = await richiediPrivato();
  const db = await creaClientServer();
  const admin = creaClientAdmin();
  const errori: Record<string, string> = {};
  const societaId = leggi(fd, "societa_id");
  const pagamentoId = leggi(fd, "modalita_pagamento_id");

  const [negozio, salvate, spese, { data: privato }, { data: indirizzi }, { data: societa }, { data: pagamento }, { data: condizioni }] = await Promise.all([
    caricaNegozio(),
    leggiCarrelloPrivato(db, utente.privatoId),
    leggiRegolaSpese(db),
    db.from("privati").select("*").eq("id", utente.privatoId).single(),
    db.from("indirizzi").select("tipo, presso, indirizzo, cap, citta, provincia").eq("privato_id", utente.privatoId),
    societaId ? db.from("societa").select("*").eq("id", societaId).eq("attiva", true).eq("attiva_privati", true).maybeSingle() : Promise.resolve({ data: null }),
    pagamentoId ? db.from("modalita_pagamento").select("*").eq("id", pagamentoId).eq("attiva", true).in("canale", ["privati", "entrambi"]).maybeSingle() : Promise.resolve({ data: null }),
    db.rpc("documento_legale_corrente", { p_tipo: "condizioni_privati" }),
  ]);
  if (!negozio.aperta) return { messaggio: "Il negozio non è ancora aperto." };
  if (!societa) errori.societa_id = "Scegli chi ti vende e spedisce";
  if (!pagamento) errori.modalita_pagamento_id = "Scegli come pagare";
  if (pagamento?.richiede_iban && societa && !(societa.iban && ibanValido(societa.iban))) errori.modalita_pagamento_id = "Il bonifico non è disponibile: scegli un'altra modalità";
  if (!fd.get("accetto_condizioni")) errori.accetto_condizioni = "Per ordinare devi accettare le condizioni di vendita";
  else if (!condizioni?.id || condizioni.id !== leggi(fd, "condizioni_documento_id")) errori.accetto_condizioni = "Le condizioni di vendita sono cambiate: rileggile e accettale di nuovo";

  const costoPagamento = pagamento?.costo_aggiuntivo_cent ?? 0;
  const carrello = verificaCarrelloPrivato(negozio, salvate, spese, costoPagamento);
  if (!carrello.inviabile) return { errori, messaggio: carrello.problemiGenerali[0] ?? "Alcuni prodotti del carrello vanno corretti." };
  if (Object.keys(errori).length || !societa || !pagamento || !condizioni || !privato) return { errori, messaggio: "Controlla i campi evidenziati." };

  const indirizzo = (tipo: string) => (indirizzi ?? []).find((i) => i.tipo === tipo) ?? null;
  const snapshotCliente: SnapshotCliente = {
    tipo: "privato",
    nome: privato.nome,
    cognome: privato.cognome,
    ragione_sociale: `${privato.nome} ${privato.cognome}`,
    titolare: privato.nome,
    partita_iva: "",
    codice_fiscale: privato.codice_fiscale,
    codice_farmacia: "",
    sdi: null,
    pec: null,
    email: privato.email,
    telefono: privato.telefono,
    consegna: indirizzo("consegna"),
    fatturazione: indirizzo("fatturazione"),
  };
  const snapshotSocieta: SnapshotSocieta = {
    id: societa.id, codice: societa.codice, ragione_sociale: societa.ragione_sociale, nome_breve: societa.nome_breve,
    sede_legale: `${societa.sede_legale_indirizzo} – ${societa.sede_legale_cap} ${societa.sede_legale_citta} (${societa.sede_legale_provincia})`,
    partita_iva: societa.partita_iva, codice_fiscale: societa.codice_fiscale, sdi: societa.sdi, pec: societa.pec, rea: societa.rea,
    capitale_sociale_testo: societa.capitale_sociale_testo, sito: societa.sito, email: societa.email, telefono: societa.telefono,
    logo_path: societa.logo_path, piede_documenti: societa.piede_documenti,
  };
  const snapshotPagamento: SnapshotPagamento = {
    codice: pagamento.codice, descrizione: pagamento.descrizione, richiede_iban: pagamento.richiede_iban, contrassegno: pagamento.contrassegno,
    iban: pagamento.richiede_iban ? societa.iban : null, intestatario: pagamento.richiede_iban ? societa.ragione_sociale : null,
    costo_aggiuntivo_cent: costoPagamento,
  };

  // Una riga per lotto assegnato; prezzi del privato (IVA inclusa e netto) nelle colonne del prezzo applicato
  const righe = carrello.righe.flatMap((r) =>
    r.lotti.map((l) => ({
      lotto_id: l.lottoId,
      prodotto_codice: r.prodotto!.codice,
      prodotto_nome: r.prodotto!.nome,
      codice_lotto: l.codiceLotto,
      scadenza: l.scadenza,
      quantita: l.quantita,
      prezzo_pubblico_cent: r.prodotto!.prezzo.pienoCent,
      iva: r.prodotto!.iva,
      sconto_applicato: r.prodotto!.prezzo.scontoPercentuale,
      prezzo_pubblico_netto_cent: scorporaIva(r.prodotto!.prezzo.pienoCent, r.prodotto!.iva),
      prezzo_farmacia_ivato_cent: r.prodotto!.prezzo.ivatoCent,
      prezzo_farmacia_netto_cent: r.prodotto!.prezzo.nettoCent,
      imponibile_cent: r.prodotto!.prezzo.nettoCent * l.quantita,
    })),
  );

  const t = carrello.totali;
  const { data: esito, error } = await admin.rpc("invia_ordine_privato", {
    p_utente: utente.id,
    p_ordine: {
      societa_id: societa.id,
      deposito_id: carrello.depositoId,
      modalita_pagamento_id: pagamento.id,
      note: leggi(fd, "note").slice(0, 1000),
      consegna_indicativa_giorni: negozio.giorniConsegna,
      snapshot_cliente: snapshotCliente,
      snapshot_societa: snapshotSocieta,
      snapshot_pagamento: snapshotPagamento,
      condizioni_documento_id: condizioni.id,
      condizioni_versione: condizioni.versione,
      imponibile_cent: t.imponibileCent,
      sconti_cent: t.scontiCent,
      iva_cent: t.ivaCent,
      iva_dettaglio: t.ivaDettaglio,
      spese_spedizione_cent: t.speseCent,
      totale_cent: t.totaleCent,
    },
    p_righe: righe,
  });
  if (error) {
    console.error("[ordine privato] invio non riuscito:", error.message);
    return { messaggio: "Invio non riuscito. Riprova tra poco: il carrello è rimasto com'era." };
  }
  if (esito.esito === "merce_insufficiente") return { messaggio: "Nel frattempo un prodotto è andato esaurito: controlla il carrello e riprova." };
  if (esito.esito !== "ok") return { messaggio: "Il tuo account non è attivo: scrivi all'assistenza." };

  const ordine = await leggiOrdine(admin, esito.ordine_id);
  if (ordine) {
    await Promise.all([
      inviaEmail(emailOrdinePrivatoRicevuto(ordine, { testo: condizioni.testo, versione: condizioni.versione })),
      emailAmministrazione().then((a) => inviaEmail(emailNuovoOrdinePrivatoAdmin(a, ordine))),
    ]);
  }
  redirect(`/negozio/ordini/${esito.ordine_id}?inviato=1`);
}
