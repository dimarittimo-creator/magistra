import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aggiungiGiorni, type DataISO } from "@/lib/date";
import type { RigaOrdine, SnapshotCliente, SnapshotPagamento, SnapshotSocieta } from "@/lib/ordini/lettura";
import { calcolaTotali, type Totali } from "@/lib/pricing";

// Verso la fatturazione (docs/DEPOSITO_E_SPEDIZIONI.md §4): il portale NON emette fatture.
// Elenco dei DDT da fatturare separato per società e canale, e valore distribuito per mese.
// Il valore si calcola sulle quantità realmente spedite ai prezzi dell'ordine (omaggi a zero).

export type DdtDaFatturare = {
  spedizioneId: string;
  ordineId: string;
  numeroOrdine: string;
  canale: "farmacie" | "privati";
  ddtNumero: string;
  ddtData: DataISO;
  fatturato: boolean;
  societaId: string;
  depositoId: string;
  societa: SnapshotSocieta;
  cliente: SnapshotCliente;
  pagamento: SnapshotPagamento;
  totali: Totali;
  righe: { prodotto: string; minsan: string; lotto: string; quantita: number; omaggio: number; prezzoNettoCent: number; iva: number }[];
  /** Scadenze RIBA stimate: data DDT + giorni, a fine mese */
  scadenzeRiba: DataISO[];
};

export type Filtri = { societaId?: string | null; canale?: string | null; stato?: "da_fatturare" | "fatturati" | "tutti"; dal?: DataISO | null; al?: DataISO | null };

function fineMese(data: DataISO): DataISO {
  const [a, m] = data.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${data.slice(0, 7)}-${String(ultimo).padStart(2, "0")}`;
}

export function scadenzeRiba(codicePagamento: string, dataDdt: DataISO): DataISO[] {
  const m = codicePagamento.match(/^riba_(\d+)$/);
  return m ? [fineMese(aggiungiGiorni(dataDdt, Number(m[1])))] : [];
}

type RigaDb = {
  id: string;
  ddt_numero: string;
  ddt_data: string;
  fatturato: boolean;
  righe: { riga_ordine_id: string | null; codice_lotto: string; quantita_spedita: number }[];
  ordine: {
    id: string;
    numero: string;
    canale: "farmacie" | "privati";
    societa_id: string;
    deposito_id: string;
    snapshot_cliente: SnapshotCliente;
    snapshot_societa: SnapshotSocieta;
    snapshot_pagamento: SnapshotPagamento;
    righe: RigaOrdine[];
  };
};

export async function leggiDdt(db: SupabaseClient, filtri: Filtri): Promise<DdtDaFatturare[]> {
  let q = db
    .from("spedizioni")
    .select("id, ddt_numero, ddt_data, fatturato, righe:righe_spedizione(riga_ordine_id, codice_lotto, quantita_spedita), ordine:ordini!inner(id, numero, canale, societa_id, deposito_id, snapshot_cliente, snapshot_societa, snapshot_pagamento, righe:righe_ordine(*))")
    .order("ddt_data", { ascending: false })
    .limit(2000);
  if (filtri.societaId) q = q.eq("ordine.societa_id", filtri.societaId);
  if (filtri.canale === "farmacie" || filtri.canale === "privati") q = q.eq("ordine.canale", filtri.canale);
  if (filtri.stato === "da_fatturare") q = q.eq("fatturato", false);
  if (filtri.stato === "fatturati") q = q.eq("fatturato", true);
  if (filtri.dal) q = q.gte("ddt_data", filtri.dal);
  if (filtri.al) q = q.lte("ddt_data", filtri.al);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as RigaDb[]).map((s) => {
    const righe = s.ordine.righe.map((r) => {
      const spedita = s.righe.find((x) => x.riga_ordine_id === r.id);
      const totale = spedita ? spedita.quantita_spedita : r.quantita + r.quantita_omaggio;
      const pagati = Math.min(totale, r.quantita);
      return {
        prodotto: r.prodotto_nome,
        minsan: r.prodotto_codice,
        lotto: spedita?.codice_lotto ?? r.codice_lotto,
        quantita: pagati,
        omaggio: totale - pagati,
        prezzoNettoCent: r.prezzo_farmacia_netto_cent,
        iva: Number(r.iva),
        prezzi: { pubblicoIvatoCent: r.prezzo_pubblico_cent, pubblicoNettoCent: r.prezzo_pubblico_netto_cent, farmaciaIvatoCent: r.prezzo_farmacia_ivato_cent, farmaciaNettoCent: r.prezzo_farmacia_netto_cent },
      };
    });
    return {
      spedizioneId: s.id,
      ordineId: s.ordine.id,
      numeroOrdine: s.ordine.numero,
      canale: s.ordine.canale,
      ddtNumero: s.ddt_numero,
      ddtData: s.ddt_data,
      fatturato: s.fatturato,
      societaId: s.ordine.societa_id,
      depositoId: s.ordine.deposito_id,
      societa: s.ordine.snapshot_societa,
      cliente: s.ordine.snapshot_cliente,
      pagamento: s.ordine.snapshot_pagamento,
      totali: calcolaTotali(righe.map((r) => ({ quantita: r.quantita, ivaPercentuale: r.iva, prezzi: r.prezzi }))),
      righe: righe.map(({ prezzi: _p, ...r }) => r),
      scadenzeRiba: scadenzeRiba(s.ordine.snapshot_pagamento.codice, s.ddt_data),
    };
  });
}

export type ValoreMese = { mese: string; depositoId: string; societaId: string; societa: string; imponibileCent: number; ddt: number };

/** Somma dell'imponibile spedito per mese (data DDT), deposito e società. */
export function valoreDistribuito(ddt: DdtDaFatturare[]): ValoreMese[] {
  const mappa = new Map<string, ValoreMese>();
  for (const d of ddt) {
    const chiave = `${d.ddtData.slice(0, 7)}|${d.depositoId}|${d.societaId}`;
    const v = mappa.get(chiave) ?? { mese: d.ddtData.slice(0, 7), depositoId: d.depositoId, societaId: d.societaId, societa: d.societa.nome_breve, imponibileCent: 0, ddt: 0 };
    v.imponibileCent += d.totali.imponibileCent;
    v.ddt += 1;
    mappa.set(chiave, v);
  }
  return [...mappa.values()].sort((a, b) => b.mese.localeCompare(a.mese) || a.societa.localeCompare(b.societa));
}
