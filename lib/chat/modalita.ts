// Quale assistente usare per una nuova conversazione (funzione pura, usata dal modello e dai test).
// - Con ANTHROPIC_API_KEY: Claude ("ai").
// - Senza chiave, in sviluppo (o con ASSISTENTE_MODALITA=prova, o con il cookie dei test): "prova".
// - Senza chiave in produzione, o con ASSISTENTE_MODALITA=spento: nessun assistente automatico ("solo_operatore").

export type Modalita = "ai" | "prova" | "solo_operatore";

export function modalitaAssistente(
  opzioni: { provaRichiesta?: boolean } = {},
  env: { NODE_ENV?: string; ASSISTENTE_MODALITA?: string; ANTHROPIC_API_KEY?: string } = process.env,
): Modalita {
  const sviluppo = env.NODE_ENV !== "production";
  if (env.ASSISTENTE_MODALITA === "spento") return "solo_operatore";
  if (sviluppo && (opzioni.provaRichiesta || env.ASSISTENTE_MODALITA === "prova")) return "prova";
  if (env.ANTHROPIC_API_KEY) return "ai";
  return sviluppo ? "prova" : "solo_operatore";
}
