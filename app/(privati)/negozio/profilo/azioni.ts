"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { richiediPrivato } from "@/lib/auth";
import { messaggioErroreAuth } from "@/lib/errori-auth";
import { valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { leggiDatiPrivato } from "@/lib/privati/dati";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";
import { passwordValida } from "@/lib/validazione";

export async function salvaProfiloPrivato(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const { privatoId } = await richiediPrivato();
  const valori = valoriModulo(fd);
  const { dati, spedizione, fatturazione, errori } = leggiDatiPrivato(fd, { anagrafica: false });
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlla i campi evidenziati." };
  const db = await creaClientServer();
  const { error } = await db.from("privati").update({ email: dati.email, telefono: dati.telefono }).eq("id", privatoId);
  if (error) return { valori, messaggio: "Salvataggio non riuscito. Riprova." };
  for (const [tipo, ind] of [["consegna", spedizione], ["fatturazione", fatturazione]] as const) {
    await db.from("indirizzi").update({ ...ind, presso: ind.presso || null }).eq("privato_id", privatoId).eq("tipo", tipo);
  }
  revalidatePath("/negozio/profilo");
  return { ok: true, valori, messaggio: "Dati salvati." };
}

export async function cambiaPasswordPrivato(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  await richiediPrivato();
  const password = String(fd.get("password") ?? "");
  if (!passwordValida(password)) return { errori: { password: "Almeno 8 caratteri, con lettere e numeri" } };
  if (password !== String(fd.get("conferma_password") ?? "")) return { errori: { conferma_password: "Le due password non coincidono" } };
  const { error } = await (await creaClientServer()).auth.updateUser({ password });
  return error ? { messaggio: messaggioErroreAuth(error) } : { ok: true, messaggio: "Password aggiornata." };
}

export async function consensoMarketingPrivato(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediPrivato();
  const accettato = Boolean(fd.get("accetto_marketing"));
  const admin = creaClientAdmin();
  const { data: privacy } = await admin.rpc("documento_legale_corrente", { p_tipo: "privacy" });
  const h = await headers();
  const { error } = await admin.from("consensi").insert({
    utente_id: utente.id, tipo: "marketing", accettato, documento_id: privacy?.id ?? null, versione_documento: privacy?.versione ?? null,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || null, user_agent: h.get("user-agent"),
  });
  if (error) return { messaggio: "Salvataggio non riuscito." };
  revalidatePath("/negozio/profilo");
  return { ok: true, messaggio: accettato ? "Riceverai le offerte del mese." : "Non riceverai più comunicazioni commerciali." };
}
