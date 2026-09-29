"use server";

import { revalidatePath } from "next/cache";
import { richiediAdmin } from "@/lib/auth";
import { leggi, type StatoModulo } from "@/lib/farmacie/dati";
import { registraOperazione } from "@/lib/registro";
import { creaClientServer } from "@/lib/supabase/server";

/** Crea un gruppo (id vuoto) o ne aggiorna uno esistente. */
export async function salvaGruppo(id: string | null, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const dati = {
    nome: leggi(fd, "nome"),
    descrizione: leggi(fd, "descrizione") || null,
    attivo: id ? Boolean(fd.get("attivo")) : true,
  };
  if (!dati.nome) return { errori: { nome: "Indica il nome del gruppo" }, valori: { nome: dati.nome, descrizione: dati.descrizione ?? "" } };

  const db = await creaClientServer();
  const { data: prima } = id ? await db.from("gruppi").select("*").eq("id", id).maybeSingle() : { data: null };
  const { data, error } = id
    ? await db.from("gruppi").update(dati).eq("id", id).select("id").single()
    : await db.from("gruppi").insert(dati).select("id").single();
  if (error) {
    if (error.code === "23505") return { errori: { nome: "Esiste già un gruppo con questo nome" }, valori: { nome: dati.nome } };
    return { messaggio: "Salvataggio non riuscito. Riprova tra poco." };
  }

  await registraOperazione(db, utente.id, {
    azione: id ? "modifica_gruppo" : "crea_gruppo",
    entita: "gruppi",
    entitaId: data.id,
    prima,
    dopo: dati,
  });
  revalidatePath("/admin/gruppi");
  return { ok: true, messaggio: id ? "Gruppo aggiornato." : `Gruppo «${dati.nome}» creato.` };
}
