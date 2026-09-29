"use server";

import { revalidatePath } from "next/cache";
import { richiediAdmin } from "@/lib/auth";
import { valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { registraOperazione } from "@/lib/registro";
import { leggiDatiSocieta } from "@/lib/societa";
import { creaClientServer } from "@/lib/supabase/server";

export async function salvaSocieta(id: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const valori = valoriModulo(fd);
  const { dati, errori } = leggiDatiSocieta(fd);
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlla i campi evidenziati." };

  const db = await creaClientServer();
  const { data: prima } = await db.from("societa").select("*").eq("id", id).maybeSingle();
  if (!prima) return { messaggio: "Società non trovata." };
  if (prima.predefinita && !dati.predefinita) {
    return { valori, errori: { predefinita: "Per cambiare la predefinita, apri l'altra società e impostala come predefinita" } };
  }

  // Una sola società predefinita: prima si toglie il segno alle altre.
  if (dati.predefinita && !prima.predefinita) {
    const { error } = await db.from("societa").update({ predefinita: false }).neq("id", id).eq("predefinita", true);
    if (error) return { valori, messaggio: "Salvataggio non riuscito. Riprova tra poco." };
  }

  const { error } = await db.from("societa").update(dati).eq("id", id);
  if (error) {
    console.error("[societa] salvataggio non riuscito:", error.message);
    return { valori, messaggio: "Salvataggio non riuscito: il database ha rifiutato i dati. Controlla partita IVA e IBAN." };
  }

  await registraOperazione(db, utente.id, { azione: "modifica_societa", entita: "societa", entitaId: id, prima, dopo: dati });
  revalidatePath("/admin/societa", "layout");
  return { ok: true, valori, messaggio: "Dati della società salvati. La modifica è nello storico qui sotto." };
}
