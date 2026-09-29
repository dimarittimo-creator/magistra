"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { emailAmministrazione } from "@/lib/email/destinatari";
import { inviaEmail } from "@/lib/email/invia";
import { emailIscrizioneRicevuta, emailNuovaIscrizioneAdmin } from "@/lib/email/modelli";
import { messaggioErroreAuth } from "@/lib/errori-auth";
import { leggiDatiFarmacia, valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";
import { passwordValida } from "@/lib/validazione";

export async function registraFarmacia(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const valori = valoriModulo(fd);
  const { dati, consegna, fatturazione, errori } = leggiDatiFarmacia(fd, { identificativi: true });

  const password = String(fd.get("password") ?? "");
  if (!passwordValida(password)) errori.password = "Almeno 8 caratteri, con lettere e numeri";
  else if (password !== String(fd.get("conferma_password") ?? "")) errori.conferma_password = "Le due password non coincidono";
  if (!fd.get("accetto_privacy")) errori.accetto_privacy = "Serve la presa visione dell'informativa privacy";
  if (!fd.get("accetto_condizioni")) errori.accetto_condizioni = "Serve l'accettazione delle condizioni di vendita";

  const admin = creaClientAdmin();

  if (Object.keys(errori).length) {
    return { errori, valori, messaggio: "Controlla i campi evidenziati." };
  }

  // 1. Account di accesso: Supabase invia l'email di conferma dell'indirizzo.
  const db = await creaClientServer();
  const { data: iscrizione, error: erroreAuth } = await db.auth.signUp({ email: dati.email!, password });
  if (erroreAuth || !iscrizione.user) {
    return { valori, messaggio: messaggioErroreAuth(erroreAuth), errori: erroreAuth?.code === "weak_password" ? { password: "Password troppo debole" } : {} };
  }
  // Email già registrata: per riservatezza Supabase non dà errore ma restituisce un utente senza identità.
  if (iscrizione.user.identities?.length === 0) {
    return { valori, errori: { email: "Esiste già un account con questa email" }, messaggio: messaggioErroreAuth({ code: "user_already_exists" }) };
  }

  // 2. Farmacia, indirizzi, profilo e consensi in un'unica transazione.
  const intestazioni = await headers();
  const ip = intestazioni.get("x-forwarded-for")?.split(",")[0]?.trim() || intestazioni.get("x-real-ip") || null;
  const { data: farmaciaId, error } = await admin.rpc("registra_farmacia", {
    p_utente: iscrizione.user.id,
    p_email: dati.email,
    p_farmacia: dati,
    p_consegna: consegna,
    p_fatturazione: fatturazione,
    p_marketing: Boolean(fd.get("accetto_marketing")),
    p_ip: ip,
    p_user_agent: intestazioni.get("user-agent"),
  });
  if (error || !farmaciaId) {
    console.error("[registrazione] salvataggio non riuscito:", error?.message);
    await admin.auth.admin.deleteUser(iscrizione.user.id);
    return { valori, messaggio: messaggioErroreAuth(null) };
  }

  // 3. Notifiche (un errore di invio non annulla l'iscrizione).
  const perEmail = { ...dati, ragione_sociale: dati.ragione_sociale!, titolare: dati.titolare!, email: dati.email!, citta: consegna.citta };
  await Promise.all([
    inviaEmail(emailIscrizioneRicevuta(perEmail)),
    emailAmministrazione().then((a) => inviaEmail(emailNuovaIscrizioneAdmin(a, { ...perEmail, id: farmaciaId as string }))),
  ]);

  redirect("/registrazione/inviata");
}
