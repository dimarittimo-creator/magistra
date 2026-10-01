"use server";

import { richiediStaff } from "@/lib/auth";
import { messaggioErroreAuth } from "@/lib/errori-auth";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { registraOperazione } from "@/lib/registro";
import { creaClientServer } from "@/lib/supabase/server";
import { passwordValida } from "@/lib/validazione";

/** Cambio password di amministratori e operatori (registrato, senza la password). */
export async function cambiaPasswordStaff(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediStaff();
  const password = String(fd.get("password") ?? "");
  if (!passwordValida(password)) return { errori: { password: "Almeno 8 caratteri, con lettere e numeri" } };
  if (password !== String(fd.get("conferma_password") ?? "")) return { errori: { conferma_password: "Le due password non coincidono" } };
  const db = await creaClientServer();
  const { error } = await db.auth.updateUser({ password });
  if (error) return { messaggio: messaggioErroreAuth(error) };
  await registraOperazione(db, utente.id, { azione: "cambio_password", entita: "profili_utente", entitaId: utente.id });
  return { ok: true, messaggio: "Password aggiornata. Dal prossimo accesso usa quella nuova." };
}
