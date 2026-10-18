"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { emailAmministrazione } from "@/lib/email/destinatari";
import { inviaEmail } from "@/lib/email/invia";
import { emailIscrizioneMedicoRicevuta, emailNuovaIscrizioneMedicoAdmin } from "@/lib/email/modelli-medici";
import { messaggioErroreAuth } from "@/lib/errori-auth";
import { valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { areaMediciAperta } from "@/lib/medici/apertura";
import { leggiDatiMedico } from "@/lib/medici/dati";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";
import { passwordValida } from "@/lib/validazione";

/** Iscrizione del medico: conferma dell'email, poi approvazione dell'amministrazione (docs/AREA_MEDICI.md §1). */
export async function registraMedico(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const valori = valoriModulo(fd);
  if (!(await areaMediciAperta())) return { valori, messaggio: "Le iscrizioni all'area Medici non sono ancora aperte." };
  const { dati, errori } = leggiDatiMedico(fd, { identificativi: true });
  const password = String(fd.get("password") ?? "");
  if (!passwordValida(password)) errori.password = "Almeno 8 caratteri, con lettere e numeri";
  else if (password !== String(fd.get("conferma_password") ?? "")) errori.conferma_password = "Le due password non coincidono";
  if (!fd.get("accetto_privacy")) errori.accetto_privacy = "Serve la presa visione dell'informativa privacy";
  if (!fd.get("dichiaro_medico")) errori.dichiaro_medico = "Serve la dichiarazione di iscrizione all'Ordine";
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlla i campi evidenziati." };

  const admin = creaClientAdmin();
  const { data: esistente } = await admin
    .from("medici")
    .select("id")
    .eq("ordine_provincia", dati.ordine_provincia!)
    .eq("numero_iscrizione", dati.numero_iscrizione!)
    .maybeSingle();
  if (esistente) {
    return { valori, errori: { numero_iscrizione: "Questo numero di iscrizione è già registrato" }, messaggio: "Esiste già un accesso con questa iscrizione all'Ordine. Se è il suo, usi «Password dimenticata» nella pagina di accesso." };
  }

  const db = await creaClientServer();
  const { data: iscrizione, error } = await db.auth.signUp({ email: dati.email!, password });
  if (error || !iscrizione.user) return { valori, messaggio: messaggioErroreAuth(error) };
  if (iscrizione.user.identities?.length === 0) {
    return { valori, errori: { email: "Esiste già un account con questa email" }, messaggio: messaggioErroreAuth({ code: "user_already_exists" }) };
  }

  const intestazioni = await headers();
  const { data: medicoId, error: e2 } = await admin.rpc("registra_medico", {
    p_utente: iscrizione.user.id,
    p_email: dati.email,
    p_medico: dati,
    p_marketing: Boolean(fd.get("accetto_marketing")),
    p_ip: intestazioni.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    p_user_agent: intestazioni.get("user-agent"),
  });
  if (e2 || !medicoId) {
    console.error("[registrazione medico] non riuscita:", e2?.message);
    await admin.auth.admin.deleteUser(iscrizione.user.id);
    return { valori, messaggio: messaggioErroreAuth(null) };
  }

  const perEmail = { nome: dati.nome!, cognome: dati.cognome!, email: dati.email! };
  await Promise.all([
    inviaEmail(emailIscrizioneMedicoRicevuta(perEmail)),
    emailAmministrazione().then((a) =>
      inviaEmail(
        emailNuovaIscrizioneMedicoAdmin(a, {
          ...perEmail,
          id: medicoId as string,
          specializzazione: dati.specializzazione!,
          numero_iscrizione: dati.numero_iscrizione!,
          ordine_provincia: dati.ordine_provincia!,
          citta: dati.citta!,
        }),
      ),
    ),
  ]);
  redirect("/registrazione/inviata?tipo=medico");
}
