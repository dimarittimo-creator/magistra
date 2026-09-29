"use server";

import { redirect } from "next/navigation";
import { messaggioErroreAuth } from "@/lib/errori-auth";
import { leggi, type StatoModulo } from "@/lib/farmacie/dati";
import { creaClientServer } from "@/lib/supabase/server";
import { emailValida, passwordValida } from "@/lib/validazione";

export async function richiediRecupero(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const email = leggi(fd, "email").toLowerCase();
  if (!emailValida(email)) return { errori: { email: "Indirizzo email non valido" }, valori: { email } };

  const db = await creaClientServer();
  const { error } = await db.auth.resetPasswordForEmail(email);
  if (error && (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")) {
    return { messaggio: messaggioErroreAuth(error), valori: { email } };
  }
  // Stesso messaggio che l'email esista o no, per non rivelare quali indirizzi sono registrati.
  return {
    ok: true,
    messaggio:
      "Se l'indirizzo è registrato riceverai a breve un'email con il link per scegliere una nuova password. Il link vale 1 ora.",
  };
}

export async function impostaNuovaPassword(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const password = String(fd.get("password") ?? "");
  if (!passwordValida(password)) return { errori: { password: "Almeno 8 caratteri, con lettere e numeri" } };
  if (password !== String(fd.get("conferma_password") ?? "")) return { errori: { conferma_password: "Le due password non coincidono" } };

  const db = await creaClientServer();
  const { error } = await db.auth.updateUser({ password });
  if (error) return { messaggio: messaggioErroreAuth(error) };
  redirect("/area");
}
