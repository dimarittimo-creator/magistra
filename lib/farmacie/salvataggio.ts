import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DatiFarmacia, DatiIndirizzo } from "./dati";

/**
 * Aggiorna anagrafica e indirizzi di una farmacia con il client dell'utente:
 * la RLS e il trigger farmacie_protegge_campi decidono cosa può cambiare.
 */
export async function aggiornaFarmacia(
  db: SupabaseClient,
  id: string,
  dati: Partial<DatiFarmacia>,
  consegna: DatiIndirizzo,
  fatturazione: DatiIndirizzo,
): Promise<{ errore?: string; codice?: string }> {
  const { error } = await db
    .from("farmacie")
    .update({ ...dati, sdi: dati.sdi || null, pec: dati.pec || null })
    .eq("id", id);
  if (error) return { errore: error.message, codice: error.code };

  for (const [tipo, ind] of [["consegna", consegna], ["fatturazione", fatturazione]] as const) {
    const { error: e } = await db
      .from("indirizzi")
      .update({ ...ind, presso: ind.presso || null })
      .eq("farmacia_id", id)
      .eq("tipo", tipo);
    if (e) return { errore: e.message, codice: e.code };
  }
  return {};
}
