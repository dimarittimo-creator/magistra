import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Modalita } from "@/lib/chat/modalita";
import { rispostaDiProva } from "@/lib/chat/modello-prova";

export { modalitaAssistente, type Modalita } from "@/lib/chat/modalita";

// Collegamento al modello linguistico (Anthropic, SDK ufficiale).
// Quale modalità usare: lib/chat/modalita.ts.

export type RichiestaModello = {
  system: Anthropic.Beta.BetaTextBlockParam[];
  tools: Anthropic.Beta.BetaTool[];
  messages: Anthropic.Beta.BetaMessageParam[];
};

export type RispostaModello = Pick<Anthropic.Beta.BetaMessage, "content" | "stop_reason"> & {
  usage: { input_tokens: number; output_tokens: number };
};

export const MODELLO_CLAUDE = "claude-opus-5-5";

let client: Anthropic | null = null;

export async function chiediAlModello(modalita: Modalita, richiesta: RichiestaModello): Promise<RispostaModello> {
  if (modalita === "prova") return rispostaDiProva(richiesta);
  if (modalita !== "ai") throw new Error("Assistente automatico non attivo");

  client ??= new Anthropic({ maxRetries: 2, timeout: 120_000 });
  const stream = client.beta.messages.stream({
    model: MODELLO_CLAUDE,
    max_tokens: 16000,
    // Se i filtri di sicurezza del modello rifiutano per errore, il servizio riprova da sé con un modello di riserva.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    // Cache automatica dell'ultima parte della conversazione (istruzioni e strumenti hanno il loro punto di cache).
    cache_control: { type: "ephemeral" },
    system: richiesta.system,
    tools: richiesta.tools,
    messages: richiesta.messages,
  });
  const r = await stream.finalMessage();
  return { content: r.content, stop_reason: r.stop_reason, usage: { input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens } };
}
