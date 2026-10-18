"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { richiediMedico } from "@/lib/auth";
import { messaggioErroreAuth } from "@/lib/errori-auth";
import { valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { campiAggiornabili, leggiDatiMedico } from "@/lib/medici/dati";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";
import { passwordValida } from "@/lib/validazione";

export async function salvaProfiloMedico(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediMedico();
  const valori = valoriModulo(fd);
  const { dati, errori } = leggiDatiMedico(fd, { identificativi: false });
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlli i campi evidenziati." };
  // Con i permessi del medico: la RLS e il controllo nel database impediscono di toccare dati identificativi e stato.
  const db = await creaClientServer();
  const { error } = await db.from("medici").update(campiAggiornabili(dati)).eq("id", utente.medicoId);
  if (error) {
    console.error("[profilo medico] salvataggio non riuscito:", error.message);
    return { valori, messaggio: "Salvataggio non riuscito. Riprovi tra poco." };
  }
  revalidatePath("/medici", "layout");
  return { ok: true, valori, messaggio: "Dati salvati." };
}

export async function cambiaPasswordMedico(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  await richiediMedico();
  const password = String(fd.get("password") ?? "");
  if (!passwordValida(password)) return { errori: { password: "Almeno 8 caratteri, con lettere e numeri" } };
  if (password !== String(fd.get("conferma_password") ?? "")) return { errori: { conferma_password: "Le due password non coincidono" } };
  const db = await creaClientServer();
  const { error } = await db.auth.updateUser({ password });
  if (error) return { messaggio: messaggioErroreAuth(error) };
  return { ok: true, messaggio: "Password aggiornata." };
}

export async function salvaMarketingMedico(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediMedico();
  const accettato = Boolean(fd.get("accetto_marketing"));
  // I consensi si scrivono solo dal server: nuova riga ogni volta, lo storico resta.
  const admin = creaClientAdmin();
  const { data: privacy } = await admin.rpc("documento_legale_corrente", { p_tipo: "privacy" });
  const intestazioni = await headers();
  const { error } = await admin.from("consensi").insert({
    utente_id: utente.id,
    tipo: "marketing",
    accettato,
    documento_id: privacy?.id ?? null,
    versione_documento: privacy?.versione ?? null,
    ip: intestazioni.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    user_agent: intestazioni.get("user-agent"),
  });
  if (error) return { messaggio: "Salvataggio non riuscito. Riprovi tra poco." };
  revalidatePath("/medici/profilo");
  return { ok: true, messaggio: accettato ? "Grazie: riceverà le nostre novità scientifiche." : "Non riceverà più comunicazioni." };
}
