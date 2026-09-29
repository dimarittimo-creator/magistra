"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { richiediFarmacia } from "@/lib/auth";
import { messaggioErroreAuth } from "@/lib/errori-auth";
import { leggiDatiFarmacia, valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { aggiornaFarmacia } from "@/lib/farmacie/salvataggio";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";
import { passwordValida } from "@/lib/validazione";

export async function salvaProfilo(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediFarmacia();
  const valori = valoriModulo(fd);
  const { dati, consegna, fatturazione, errori } = leggiDatiFarmacia(fd, { identificativi: false });
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlla i campi evidenziati." };

  const db = await creaClientServer();
  const esito = await aggiornaFarmacia(db, utente.profilo.farmacia_id!, dati, consegna, fatturazione);
  if (esito.errore) {
    console.error("[profilo] salvataggio non riuscito:", esito.errore);
    return { valori, messaggio: "Salvataggio non riuscito. Riprova tra poco." };
  }
  revalidatePath("/farmacia", "layout");
  return { ok: true, valori, messaggio: "Dati salvati." };
}

export async function cambiaPassword(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  await richiediFarmacia();
  const password = String(fd.get("password") ?? "");
  if (!passwordValida(password)) return { errori: { password: "Almeno 8 caratteri, con lettere e numeri" } };
  if (password !== String(fd.get("conferma_password") ?? "")) return { errori: { conferma_password: "Le due password non coincidono" } };
  const db = await creaClientServer();
  const { error } = await db.auth.updateUser({ password });
  if (error) return { messaggio: messaggioErroreAuth(error) };
  return { ok: true, messaggio: "Password aggiornata." };
}

export async function salvaConsensoMarketing(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediFarmacia();
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
  if (error) return { messaggio: "Salvataggio non riuscito. Riprova tra poco." };
  revalidatePath("/farmacia/profilo");
  return {
    ok: true,
    messaggio: accettato ? "Grazie: riceverai le nostre promozioni e novità." : "Non riceverai più comunicazioni commerciali.",
  };
}
