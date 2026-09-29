"use server";

import { revalidatePath } from "next/cache";
import { richiediAdmin } from "@/lib/auth";
import { registraOperazione } from "@/lib/registro";
import { creaClientServer } from "@/lib/supabase/server";

/** Segna come fatturati (o toglie il segno) i DDT selezionati. */
export async function segnaFatturati(fd: FormData) {
  const utente = await richiediAdmin();
  const ids = fd.getAll("ddt").map(String).filter(Boolean);
  const fatturato = fd.get("azione") !== "annulla";
  if (!ids.length) return;
  const db = await creaClientServer();
  await db
    .from("spedizioni")
    .update({ fatturato, fatturato_il: fatturato ? new Date().toISOString() : null, fatturato_da: fatturato ? utente.id : null })
    .in("id", ids);
  await registraOperazione(db, utente.id, { azione: fatturato ? "segna_fatturato" : "annulla_fatturato", entita: "spedizioni", dopo: { ddt: ids } });
  revalidatePath("/admin/fatturazione");
}
