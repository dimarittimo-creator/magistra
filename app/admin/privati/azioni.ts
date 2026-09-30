"use server";

import { revalidatePath } from "next/cache";
import { richiediAdmin } from "@/lib/auth";
import { registraOperazione } from "@/lib/registro";
import { creaClientServer } from "@/lib/supabase/server";

export async function cambiaStatoPrivato(id: string, blocca: boolean) {
  const utente = await richiediAdmin();
  const db = await creaClientServer();
  await db.from("privati").update(blocca ? { stato: "bloccato", bloccato_il: new Date().toISOString() } : { stato: "attivo", bloccato_il: null, motivo_blocco: null }).eq("id", id);
  await registraOperazione(db, utente.id, { azione: blocca ? "blocca_privato" : "sblocca_privato", entita: "privati", entitaId: id });
  revalidatePath("/admin/privati");
}
