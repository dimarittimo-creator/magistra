"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { messaggioErroreAuth } from "@/lib/errori-auth";
import { valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { areaPrivatiAperta } from "@/lib/negozio";
import { leggiDatiPrivato } from "@/lib/privati/dati";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";
import { passwordValida } from "@/lib/validazione";

/** Registrazione del cliente privato: attivo appena conferma l'email (nessuna approvazione manuale). */
export async function registraPrivato(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  if (!(await areaPrivatiAperta())) return { messaggio: "Il negozio per i privati non è ancora aperto." };
  const valori = valoriModulo(fd);
  const { dati, spedizione, fatturazione, errori } = leggiDatiPrivato(fd, { anagrafica: true });
  const password = String(fd.get("password") ?? "");
  if (!passwordValida(password)) errori.password = "Almeno 8 caratteri, con lettere e numeri";
  else if (password !== String(fd.get("conferma_password") ?? "")) errori.conferma_password = "Le due password non coincidono";
  if (!fd.get("accetto_privacy")) errori.accetto_privacy = "Serve la presa visione dell'informativa privacy";
  if (!fd.get("accetto_condizioni")) errori.accetto_condizioni = "Serve l'accettazione delle condizioni di vendita";
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlla i campi evidenziati." };

  const db = await creaClientServer();
  const prossima = String(fd.get("prossima") ?? "");
  const { data: iscrizione, error } = await db.auth.signUp({ email: dati.email!, password });
  if (error || !iscrizione.user) return { valori, messaggio: messaggioErroreAuth(error) };
  if (iscrizione.user.identities?.length === 0) {
    return { valori, errori: { email: "Esiste già un account con questa email" }, messaggio: messaggioErroreAuth({ code: "user_already_exists" }) };
  }

  const admin = creaClientAdmin();
  const intestazioni = await headers();
  const { error: e2 } = await admin.rpc("registra_privato", {
    p_utente: iscrizione.user.id,
    p_email: dati.email,
    p_privato: dati,
    p_spedizione: spedizione,
    p_fatturazione: fatturazione,
    p_marketing: Boolean(fd.get("accetto_marketing")),
    p_ip: intestazioni.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    p_user_agent: intestazioni.get("user-agent"),
  });
  if (e2) {
    console.error("[registrazione privato] non riuscita:", e2.message);
    await admin.auth.admin.deleteUser(iscrizione.user.id);
    return { valori, messaggio: messaggioErroreAuth(null) };
  }
  redirect(`/registrazione/inviata?tipo=privato${prossima.startsWith("/negozio") ? `&prossima=${encodeURIComponent(prossima)}` : ""}`);
}
