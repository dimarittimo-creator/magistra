import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { calcolaEmbedding, vettore } from "@/lib/chat/embedding";
import { dividiInFrammenti } from "@/lib/chat/frammenti";

// Base di conoscenza dell'assistente (docs/CONFORMITA.md "Chatbot"): solo contenuti approvati dal gruppo.
// È indipendente dal canale: la stessa ricerca serve alla chat e alla futura versione vocale.

export type Pubblico = "tutti" | "farmacie" | "privati" | "medici";

export type RisultatoKb = { titolo: string; tipo: string; prodotto_codice: string | null; testo: string };

/** Rigenera i frammenti di un documento (dopo ogni modifica del testo). */
export async function rigeneraFrammenti(db: SupabaseClient, documentoId: string): Promise<void> {
  const { data: doc, error } = await db.from("kb_documenti").select("titolo, testo").eq("id", documentoId).single();
  if (error) throw new Error(error.message);
  const testi = dividiInFrammenti(doc.titolo, doc.testo);
  const vettori = await calcolaEmbedding(testi, "document");

  const { error: errCanc } = await db.from("kb_frammenti").delete().eq("documento_id", documentoId);
  if (errCanc) throw new Error(errCanc.message);
  if (!testi.length) return;
  const { error: errIns } = await db.from("kb_frammenti").insert(
    testi.map((testo, i) => ({ documento_id: documentoId, posizione: i, testo, embedding: vettori ? vettore(vettori[i]) : null })),
  );
  if (errIns) throw new Error(errIns.message);
}

/** Cerca nei documenti approvati destinati a questo pubblico. */
export async function cercaKb(db: SupabaseClient, domanda: string, pubblico: Pubblico, limite = 5): Promise<RisultatoKb[]> {
  const [v] = (await calcolaEmbedding([domanda], "query")) ?? [];
  const { data, error } = await db.rpc("cerca_kb", {
    p_domanda: domanda,
    p_pubblico: pubblico,
    p_embedding: v ? vettore(v) : null,
    p_limite: limite,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as RisultatoKb[]).map(({ titolo, tipo, prodotto_codice, testo }) => ({ titolo, tipo, prodotto_codice, testo }));
}
