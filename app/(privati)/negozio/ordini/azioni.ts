"use server";

import { revalidatePath } from "next/cache";
import { richiediPrivato } from "@/lib/auth";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { leggiOrdine } from "@/lib/ordini/lettura";
import { rispondiModifiche } from "@/lib/ordini/modifiche";
import { creaClientServer } from "@/lib/supabase/server";

/** Il cliente privato accetta o rifiuta le modifiche fatte dall'amministrazione al suo ordine. */
export async function rispondiModifichePrivato(ordineId: string, accetta: boolean, _prima: StatoModulo): Promise<StatoModulo> {
  const utente = await richiediPrivato();
  const ordine = await leggiOrdine(await creaClientServer(), ordineId);
  if (!ordine || ordine.privato_id !== utente.privatoId) return { messaggio: "Ordine non trovato." };
  const esito = await rispondiModifiche(ordineId, utente.id, accetta);
  revalidatePath(`/negozio/ordini/${ordineId}`);
  return { ok: esito.ok, messaggio: esito.messaggio };
}
