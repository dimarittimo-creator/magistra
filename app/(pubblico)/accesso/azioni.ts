"use server";

import { redirect } from "next/navigation";
import { percorsoSicuro } from "@/lib/auth";
import { messaggioErroreAuth } from "@/lib/errori-auth";
import { leggi, type StatoModulo } from "@/lib/farmacie/dati";
import { creaClientServer } from "@/lib/supabase/server";

export type StatoAccesso = StatoModulo & { emailDaConfermare?: string };

export async function accedi(_prima: StatoAccesso, fd: FormData): Promise<StatoAccesso> {
  const email = leggi(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) {
    return { messaggio: "Inserisci email e password.", valori: { email } };
  }

  const db = await creaClientServer();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      messaggio: messaggioErroreAuth(error),
      valori: { email },
      emailDaConfermare: error.code === "email_not_confirmed" ? email : undefined,
    };
  }
  redirect(percorsoSicuro(fd.get("prossima")));
}

export async function reinviaConferma(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const email = leggi(fd, "email").toLowerCase();
  const db = await creaClientServer();
  const { error } = await db.auth.resend({ type: "signup", email });
  if (error) return { messaggio: messaggioErroreAuth(error) };
  return { ok: true, messaggio: "Ti abbiamo inviato di nuovo l'email di conferma. Controlla anche la posta indesiderata." };
}
