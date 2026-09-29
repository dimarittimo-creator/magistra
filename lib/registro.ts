import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Scrive una riga nel registro operazioni (non modificabile) a nome dell'utente collegato.
 * Da chiamare dopo ogni azione dell'area amministrazione.
 */
export async function registraOperazione(
  db: SupabaseClient,
  utenteId: string,
  voce: { azione: string; entita: string; entitaId?: string; prima?: unknown; dopo?: unknown },
) {
  const { error } = await db.from("registro_operazioni").insert({
    utente: utenteId,
    azione: voce.azione,
    entita: voce.entita,
    entita_id: voce.entitaId ?? null,
    prima: voce.prima ?? null,
    dopo: voce.dopo ?? null,
  });
  if (error) console.error("[registro] scrittura non riuscita:", error.message, voce);
}
