"use server";

import { revalidatePath } from "next/cache";
import { richiediStaff } from "@/lib/auth";
import { inviaOrdiniAlDeposito } from "@/lib/deposito/invio";
import { inviaEmail } from "@/lib/email/invia";
import { emailCambioStato } from "@/lib/email/modelli-ordini";
import { leggi, type StatoModulo } from "@/lib/farmacie/dati";
import { leggiOrdine, type SnapshotPagamento, type SnapshotSocieta } from "@/lib/ordini/lettura";
import type { StatoOrdine } from "@/lib/ordini/stati";
import { calcolaTotali } from "@/lib/pricing";
import { registraOperazione } from "@/lib/registro";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";
import { ibanValido } from "@/lib/validazione";

// Passaggi di stato consentiti dall'amministrazione (docs/DEPOSITO_E_SPEDIZIONI.md).
const CONSENTITI: Partial<Record<StatoOrdine, StatoOrdine[]>> = {
  inviato: ["in_verifica", "confermato", "rifiutato"],
  in_verifica: ["confermato", "rifiutato"],
  confermato: ["rifiutato"],
  modificato: ["rifiutato"],
  inviato_deposito: ["in_preparazione"],
  spedito: ["consegnato"],
};

function aggiorna(id: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/farmacia/ordini/${id}`);
}

/** Cambio di stato semplice, con messaggio facoltativo alla farmacia (obbligatorio per il rifiuto). */
export async function cambiaStato(id: string, nuovo: StatoOrdine, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediStaff();
  const messaggio = leggi(fd, "messaggio").slice(0, 1000) || null;
  if (nuovo === "rifiutato" && !messaggio) return { errori: { messaggio: "Scrivi il motivo del rifiuto: lo riceverà la farmacia" } };

  const db = await creaClientServer();
  const { data: o } = await db.from("ordini").select("stato, numero").eq("id", id).single();
  if (!o || !CONSENTITI[o.stato as StatoOrdine]?.includes(nuovo)) return { messaggio: "Operazione non consentita in questo stato: ricarica la pagina." };

  const { error } = await db.from("ordini").update({ stato: nuovo }).eq("id", id).eq("stato", o.stato);
  if (error) return { messaggio: "Aggiornamento non riuscito. Riprova." };
  await db.from("storico_stati").insert({ ordine_id: id, da: o.stato, a: nuovo, utente: utente.id, messaggio });
  await registraOperazione(db, utente.id, { azione: `ordine_${nuovo}`, entita: "ordini", entitaId: id, prima: { stato: o.stato }, dopo: { stato: nuovo, messaggio } });

  const ordine = await leggiOrdine(db, id);
  if (ordine) await inviaEmail(emailCambioStato(ordine, messaggio));
  aggiorna(id);
  return { ok: true, messaggio: "Stato aggiornato: la farmacia riceve un'email." };
}

export type ModificaOrdine = {
  righe: { rigaId: string; quantita: number }[];
  societaId: string;
  pagamentoId: string;
  messaggio: string;
};

/**
 * Modifica prima dell'invio al deposito: quantità (0 = riga tolta), società che fattura, pagamento.
 * I prezzi delle righe restano quelli dell'ordine; la merce si ricontrolla con i lotti bloccati.
 */
export async function modificaOrdine(id: string, m: ModificaOrdine): Promise<StatoModulo & { righe?: Record<string, string> }> {
  const utente = await richiediStaff();
  const db = await creaClientServer();
  const ordine = await leggiOrdine(db, id);
  if (!ordine) return { messaggio: "Ordine non trovato." };

  const nuove = ordine.righe
    .map((r) => ({ r, q: m.righe.find((x) => x.rigaId === r.id)?.quantita ?? r.quantita }))
    .filter(({ q }) => q > 0);
  if (m.righe.some((x) => !Number.isInteger(x.quantita) || x.quantita < 0)) return { messaggio: "Quantità non valide." };
  if (!nuove.length) return { messaggio: "L'ordine non può restare vuoto: per annullarlo usa «Rifiuta»." };

  const [{ data: societa }, { data: pagamento }] = await Promise.all([
    db.from("societa").select("*").eq("id", m.societaId).eq("attiva", true).maybeSingle(),
    db.from("modalita_pagamento").select("*").eq("id", m.pagamentoId).eq("attiva", true).maybeSingle(),
  ]);
  if (!societa || !pagamento) return { messaggio: "Società o modalità di pagamento non valide." };
  if (pagamento.richiede_iban && !(societa.iban && ibanValido(societa.iban))) return { messaggio: `Il bonifico non è disponibile con ${societa.nome_breve}: manca un IBAN valido.` };

  const righe = nuove.map(({ r, q }) => ({ ...r, quantita: q, imponibile_cent: r.prezzo_farmacia_netto_cent * q }));
  const totali = calcolaTotali(
    righe.map((r) => ({
      quantita: r.quantita,
      ivaPercentuale: r.iva,
      prezzi: { pubblicoIvatoCent: r.prezzo_pubblico_cent, pubblicoNettoCent: r.prezzo_pubblico_netto_cent, farmaciaIvatoCent: r.prezzo_farmacia_ivato_cent, farmaciaNettoCent: r.prezzo_farmacia_netto_cent },
    })),
  );
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
  };

  const { data: esito, error } = await creaClientAdmin().rpc("modifica_ordine_admin", {
    p_utente: utente.id,
    p_ordine: id,
    p_testata: {
      societa_id: societa.id, modalita_pagamento_id: pagamento.id, snapshot_societa: snapshotSocieta, snapshot_pagamento: snapshotPagamento,
      imponibile_cent: totali.imponibileCent, sconti_cent: totali.scontiCent, iva_cent: totali.ivaCent, iva_dettaglio: totali.ivaDettaglio, totale_cent: totali.totaleCent,
    },
    p_righe: righe.map((r) => ({ ...r, promozione_id: null })),
    p_messaggio: m.messaggio.slice(0, 1000) || "Ordine confermato con modifiche",
  });
  if (error) return { messaggio: "Modifica non riuscita. Riprova." };
  if (esito.esito === "merce_insufficiente") {
    const perLotto: Record<string, string> = {};
    for (const r of esito.righe as { lotto_id: string; disponibile: number }[]) perLotto[r.lotto_id] = `al massimo ${r.disponibile} pezzi`;
    return { righe: perLotto, messaggio: "Per alcune righe non c'è abbastanza merce." };
  }
  if (esito.esito !== "ok") return { messaggio: "L'ordine non è più modificabile (già inviato al deposito?)." };

  await registraOperazione(db, utente.id, {
    azione: "modifica_ordine",
    entita: "ordini",
    entitaId: id,
    prima: { societa: ordine.snapshot_societa.nome_breve, pagamento: ordine.snapshot_pagamento.descrizione, righe: ordine.righe.map((r) => [r.codice_lotto, r.quantita]), totale: ordine.totale_cent },
    dopo: { societa: societa.nome_breve, pagamento: pagamento.descrizione, righe: righe.map((r) => [r.codice_lotto, r.quantita]), totale: totali.totaleCent },
  });
  const aggiornato = await leggiOrdine(db, id);
  if (aggiornato) await inviaEmail(emailCambioStato(aggiornato, m.messaggio || null));
  aggiorna(id);
  return { ok: true, messaggio: "Ordine modificato e confermato: la farmacia riceve il riepilogo aggiornato." };
}

/** Ordini dei privati con bonifico: vanno al deposito solo dopo che l'admin segna il pagamento ricevuto. */
export async function segnaPagamentoRicevuto(id: string): Promise<StatoModulo> {
  const utente = await richiediStaff();
  const db = await creaClientServer();
  const { data: o } = await db.from("ordini").select("stato, pagamento_ricevuto_il").eq("id", id).single();
  if (!o || o.pagamento_ricevuto_il) return { messaggio: "Pagamento già registrato." };
  await db.from("ordini").update({ pagamento_ricevuto_il: new Date().toISOString() }).eq("id", id);
  await db.from("storico_stati").insert({ ordine_id: id, da: o.stato, a: o.stato, utente: utente.id, messaggio: "Pagamento ricevuto" });
  await registraOperazione(db, utente.id, { azione: "pagamento_ricevuto", entita: "ordini", entitaId: id });
  aggiorna(id);
  return { ok: true, messaggio: "Pagamento registrato: ora l'ordine può partire per il deposito." };
}

export async function inviaAlDeposito(id: string): Promise<StatoModulo> {
  const utente = await richiediStaff();
  const esito = await inviaOrdiniAlDeposito(creaClientAdmin(), [id], { modalita: "singola", utente: utente.id });
  const db = await creaClientServer();
  if (esito.inviati.length) await registraOperazione(db, utente.id, { azione: "invia_deposito", entita: "ordini", entitaId: id });
  aggiorna(id);
  return esito.inviati.length ? { ok: true, messaggio: "Richiesta di evasione inviata al deposito." } : { messaggio: esito.errori.join(" · ") || "Invio non riuscito." };
}

/** Registrazione del DDT: dati del documento, PDF facoltativo, quantità e lotti realmente spediti. */
export async function registraDdt(id: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediStaff();
  const errori: Record<string, string> = {};
  const numero = leggi(fd, "ddt_numero");
  const data = leggi(fd, "ddt_data");
  const colliTesto = leggi(fd, "colli");
  const colli = colliTesto ? Number(colliTesto) : null;
  if (!numero) errori.ddt_numero = "Indica il numero del DDT";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) errori.ddt_data = "Indica la data del DDT";
  if (colli != null && (!Number.isInteger(colli) || colli < 1)) errori.colli = "Numero di colli non valido";
  const file = fd.get("ddt_pdf");
  const pdf = file instanceof File && file.size > 0 ? file : null;
  if (pdf && pdf.type !== "application/pdf") errori.ddt_pdf = "Il DDT deve essere un PDF";

  const db = await creaClientServer();
  const ordine = await leggiOrdine(db, id);
  if (!ordine || !["inviato_deposito", "in_preparazione"].includes(ordine.stato)) return { messaggio: "Il DDT si registra sugli ordini inviati al deposito." };

  // Righe spedite: per ogni riga d'ordine, quantità e lotto effettivi (se diversi → differenza)
  const righe = ordine.righe.map((r) => {
    const q = Number(leggi(fd, `q_${r.id}`) || String(r.quantita + r.quantita_omaggio));
    const lotto = leggi(fd, `lotto_${r.id}`) || r.codice_lotto;
    if (!Number.isInteger(q) || q < 0) errori[`q_${r.id}`] = "Quantità non valida";
    const nota = leggi(fd, `nota_${r.id}`) || null;
    return { r, q, lotto, nota };
  });
  if (Object.keys(errori).length) return { errori, messaggio: "Controlla i campi evidenziati." };

  // Lotto spedito diverso da quello ordinato: deve esistere per lo stesso prodotto e deposito
  const admin = creaClientAdmin();
  const lottiDiversi = righe.filter((x) => x.lotto !== x.r.codice_lotto);
  const idLotti = new Map<string, string>();
  for (const x of lottiDiversi) {
    const { data: l } = await admin.from("lotti").select("id").eq("prodotto_codice", x.r.prodotto_codice).eq("deposito_id", ordine.deposito_id).eq("codice_lotto", x.lotto).maybeSingle();
    if (!l) errori[`lotto_${x.r.id}`] = `Lotto ${x.lotto} non trovato per questo prodotto`;
    else idLotti.set(x.r.id, l.id);
  }
  if (Object.keys(errori).length) return { errori, messaggio: "Controlla i campi evidenziati." };

  let percorso: string | null = null;
  if (pdf) {
    percorso = `${id}/${Date.now()}-${numero.replace(/[^\w-]/g, "_")}.pdf`;
    const { error } = await admin.storage.from("ddt").upload(percorso, new Uint8Array(await pdf.arrayBuffer()), { contentType: "application/pdf" });
    if (error) return { errori: { ddt_pdf: "Caricamento del PDF non riuscito" } };
  }

  const { data: sped, error } = await db
    .from("spedizioni")
    .insert({ ordine_id: id, ddt_numero: numero, ddt_data: data, corriere: leggi(fd, "corriere") || null, tracking: leggi(fd, "tracking") || null, colli, ddt_pdf_path: percorso, note: leggi(fd, "note") || null, registrata_da: utente.id })
    .select("id")
    .single();
  if (error) return { messaggio: error.code === "23505" ? "Per questo ordine il DDT è già registrato." : "Registrazione non riuscita. Riprova." };

  await db.from("righe_spedizione").insert(
    righe.map((x) => ({
      spedizione_id: sped.id,
      riga_ordine_id: x.r.id,
      lotto_id: idLotti.get(x.r.id) ?? x.r.lotto_id,
      prodotto_codice: x.r.prodotto_codice,
      codice_lotto: x.lotto,
      quantita_spedita: x.q,
      nota_differenza: x.nota,
    })),
  );
  const differenze = righe
    .filter((x) => x.q !== x.r.quantita + x.r.quantita_omaggio || x.lotto !== x.r.codice_lotto)
    .map((x) => `${x.r.prodotto_nome}: ordinati ${x.r.quantita + x.r.quantita_omaggio} del lotto ${x.r.codice_lotto}, spediti ${x.q} del lotto ${x.lotto}${x.nota ? ` (${x.nota})` : ""}`);

  await db.from("ordini").update({ stato: "spedito" }).eq("id", id);
  await db.from("storico_stati").insert({ ordine_id: id, da: ordine.stato, a: "spedito", utente: utente.id, messaggio: `DDT n. ${numero} del ${data.split("-").reverse().join("/")}` });
  await registraOperazione(db, utente.id, { azione: "registra_ddt", entita: "ordini", entitaId: id, dopo: { ddt_numero: numero, ddt_data: data, differenze } });

  const aggiornato = await leggiOrdine(db, id);
  if (aggiornato) {
    await inviaEmail(emailCambioStato(aggiornato, null, { ddt_numero: numero, ddt_data: data, corriere: leggi(fd, "corriere") || null, tracking: leggi(fd, "tracking") || null, colli, differenze }));
  }
  aggiorna(id);
  return { ok: true, messaggio: differenze.length ? `DDT registrato con ${differenze.length} differenze: la farmacia le vede nell'ordine.` : "DDT registrato: la farmacia lo vede nell'ordine." };
}

/** Carica o sostituisce il PDF del DDT reale su una spedizione già registrata. */
export async function caricaPdfDdt(ordineId: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediStaff();
  const file = fd.get("ddt_pdf");
  if (!(file instanceof File) || file.size === 0 || file.type !== "application/pdf") return { messaggio: "Scegli il PDF del DDT." };
  const db = await creaClientServer();
  const { data: sped } = await db.from("spedizioni").select("id, ddt_numero").eq("ordine_id", ordineId).single();
  if (!sped) return { messaggio: "Registra prima il DDT." };
  const percorso = `${ordineId}/${Date.now()}-${sped.ddt_numero.replace(/[^\w-]/g, "_")}.pdf`;
  const { error } = await creaClientAdmin().storage.from("ddt").upload(percorso, new Uint8Array(await file.arrayBuffer()), { contentType: "application/pdf" });
  if (error) return { messaggio: "Caricamento non riuscito." };
  await db.from("spedizioni").update({ ddt_pdf_path: percorso }).eq("id", sped.id);
  await registraOperazione(db, utente.id, { azione: "carica_pdf_ddt", entita: "ordini", entitaId: ordineId });
  aggiorna(ordineId);
  return { ok: true, messaggio: "PDF del DDT caricato: la farmacia può scaricarlo." };
}
