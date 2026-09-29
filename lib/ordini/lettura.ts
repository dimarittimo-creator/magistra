import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatoOrdine } from "./stati";

// Fotografia salvata nell'ordine al momento dell'invio: i documenti e le email
// usano sempre questi dati, anche se poi farmacia o società cambiano.

export type IndirizzoSnapshot = { presso: string | null; indirizzo: string; cap: string; citta: string; provincia: string };

export type SnapshotCliente = {
  tipo: "farmacia";
  ragione_sociale: string;
  titolare: string;
  partita_iva: string;
  codice_fiscale: string;
  codice_farmacia: string;
  sdi: string | null;
  pec: string | null;
  email: string;
  telefono: string;
  consegna: IndirizzoSnapshot | null;
  fatturazione: IndirizzoSnapshot | null;
};

export type SnapshotSocieta = {
  id: string;
  codice: string;
  ragione_sociale: string;
  nome_breve: string;
  sede_legale: string;
  partita_iva: string;
  codice_fiscale: string;
  sdi: string | null;
  pec: string | null;
  rea: string | null;
  capitale_sociale_testo: string | null;
  sito: string | null;
  email: string | null;
  telefono: string | null;
  logo_path: string | null;
  piede_documenti: string | null;
};

export type SnapshotPagamento = {
  codice: string;
  descrizione: string;
  richiede_iban: boolean;
  contrassegno: boolean;
  /** IBAN della società che fattura, solo per il bonifico. */
  iban: string | null;
  intestatario: string | null;
};

export type RigaOrdine = {
  id: string;
  lotto_id: string;
  prodotto_codice: string;
  prodotto_nome: string;
  codice_lotto: string;
  scadenza: string;
  quantita: number;
  quantita_omaggio: number;
  prezzo_pubblico_cent: number;
  iva: number;
  sconto_applicato: number;
  origine_sconto: string;
  prezzo_pubblico_netto_cent: number;
  prezzo_farmacia_ivato_cent: number;
  prezzo_farmacia_netto_cent: number;
  imponibile_cent: number;
  posizione: number;
};

export type Ordine = {
  id: string;
  numero: string;
  canale: "farmacie" | "privati";
  farmacia_id: string | null;
  societa_id: string;
  deposito_id: string;
  stato: StatoOrdine;
  note: string | null;
  data_consegna_desiderata: string | null;
  consegna_indicativa_giorni: number;
  scade_il: string | null;
  snapshot_cliente: SnapshotCliente;
  snapshot_societa: SnapshotSocieta;
  snapshot_pagamento: SnapshotPagamento;
  condizioni_documento_id: string;
  condizioni_versione: number;
  imponibile_cent: number;
  sconti_cent: number;
  iva_cent: number;
  iva_dettaglio: { aliquota: number; imponibileCent: number; ivaCent: number }[];
  spese_spedizione_cent: number;
  totale_cent: number;
  creato_il: string;
  righe: RigaOrdine[];
  storico: { id: number; da: StatoOrdine | null; a: StatoOrdine; messaggio: string | null; il: string }[];
};

/** Ordine completo di righe e storico (la RLS decide chi può leggerlo). */
export async function leggiOrdine(db: SupabaseClient, id: string): Promise<Ordine | null> {
  const { data } = await db
    .from("ordini")
    .select("*, righe:righe_ordine(*), storico:storico_stati(id, da, a, messaggio, il)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const o = data as unknown as Ordine;
  o.righe = [...o.righe].sort((a, b) => a.posizione - b.posizione).map((r) => ({ ...r, iva: Number(r.iva), sconto_applicato: Number(r.sconto_applicato) }));
  o.storico = [...o.storico].sort((a, b) => a.il.localeCompare(b.il));
  return o;
}

export function formattaIndirizzoSnapshot(i: IndirizzoSnapshot | null): string {
  if (!i) return "—";
  return `${i.presso ? `c/o ${i.presso}, ` : ""}${i.indirizzo} – ${i.cap} ${i.citta} (${i.provincia})`;
}
