"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { richiediAdmin } from "@/lib/auth";
import { valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { registraOperazione } from "@/lib/registro";
import { leggiDatiSede } from "@/lib/sedi";
import { creaClientServer } from "@/lib/supabase/server";

/** Crea una sede (id null) o ne aggiorna una. Le sedi non si cancellano: si disattivano. */
export async function salvaSede(id: string | null, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const valori = valoriModulo(fd);
  const { dati, errori } = leggiDatiSede(fd);
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlla i campi evidenziati." };

  const db = await creaClientServer();
  const { data: prima } = id ? await db.from("sedi").select("*").eq("id", id).maybeSingle() : { data: null };
  if (id && !prima) return { messaggio: "Sede non trovata." };

  if (prima?.predefinito && !dati.predefinito) {
    return { valori, errori: { predefinito: "Per cambiare il deposito predefinito, apri l'altro deposito e impostalo come predefinito" } };
  }

  // Un solo deposito predefinito: prima si toglie il segno agli altri.
  if (dati.predefinito && !prima?.predefinito) {
    const q = db.from("sedi").update({ predefinito: false }).eq("predefinito", true);
    const { error } = id ? await q.neq("id", id) : await q;
    if (error) return { valori, messaggio: "Salvataggio non riuscito. Riprova tra poco." };
  }

  const { data, error } = id
    ? await db.from("sedi").update(dati).eq("id", id).select("id").single()
    : await db.from("sedi").insert(dati).select("id").single();
  if (error) {
    console.error("[sedi] salvataggio non riuscito:", error.message);
    return { valori, messaggio: "Salvataggio non riuscito. Riprova tra poco." };
  }

  await registraOperazione(db, utente.id, {
    azione: id ? "modifica_sede" : "crea_sede",
    entita: "sedi",
    entitaId: data.id,
    prima,
    dopo: dati,
  });
  revalidatePath("/admin/sedi", "layout");
  if (!id) redirect(`/admin/sedi/${data.id}?creata=1`);
  return { ok: true, valori, messaggio: "Sede salvata." };
}
