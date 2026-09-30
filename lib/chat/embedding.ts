import "server-only";

// Ricerca "per significato" (vettori pgvector), facoltativa.
// Anthropic non offre un servizio di embedding: se è presente VOYAGE_API_KEY si usa Voyage AI
// (servizio a pagamento, da attivare solo con l'ok del gruppo); senza chiave la base di conoscenza
// si cerca per parole (ricerca testuale in italiano di Postgres), che resta sempre attiva.

const MODELLO = "voyage-3.5";
const DIMENSIONI = 1024;

export function embeddingAttivo(): boolean {
  return !!process.env.VOYAGE_API_KEY;
}

/** Vettori dei testi, o null se il servizio non è configurato o non risponde (si ripiega sulla ricerca testuale). */
export async function calcolaEmbedding(testi: string[], tipo: "document" | "query"): Promise<number[][] | null> {
  if (!embeddingAttivo() || testi.length === 0) return null;
  try {
    const r = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.VOYAGE_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: MODELLO, input: testi, input_type: tipo, output_dimension: DIMENSIONI }),
    });
    if (!r.ok) throw new Error(`Voyage ${r.status}: ${await r.text()}`);
    const json = (await r.json()) as { data: { embedding: number[]; index: number }[] };
    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  } catch (e) {
    console.error("[kb] embedding non riuscito, uso la ricerca testuale:", e);
    return null;
  }
}

/** Formato accettato da pgvector: "[0.1,0.2,…]" */
export function vettore(v: number[]): string {
  return `[${v.join(",")}]`;
}
