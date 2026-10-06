"use server";

import { revalidatePath } from "next/cache";
import { richiediAdmin } from "@/lib/auth";
import { leggi, valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { registraOperazione } from "@/lib/registro";
import { creaClientServer } from "@/lib/supabase/server";
import { emailValida } from "@/lib/validazione";

export async function salvaImpostazioni(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const valori = valoriModulo(fd);
  const errori: Record<string, string> = {};
  const intero = (nome: string, min: number, max: number, facoltativo = false) => {
    const t = leggi(fd, nome);
    if (!t && facoltativo) return null;
    const n = Number(t);
    if (!Number.isInteger(n) || n < min || n > max) errori[nome] = `Numero intero tra ${min} e ${max}`;
    return n;
  };
  const euro = (nome: string) => {
    const t = leggi(fd, nome).replace(",", ".");
    if (!t) return null;
    const n = Math.round(Number(t) * 100);
    if (!Number.isFinite(n) || n < 0) errori[nome] = "Importo non valido";
    return n;
  };
  const orario = leggi(fd, "orario_invio_cumulativo");
  if (!/^\d{2}:\d{2}$/.test(orario)) errori.orario_invio_cumulativo = "Orario non valido (hh:mm)";
  const email = leggi(fd, "email_notifiche_admin").split(/[\s,;]+/).map((e) => e.toLowerCase()).filter(Boolean);
  const errate = email.filter((e) => !emailValida(e));
  if (errate.length) errori.email_notifiche_admin = `Indirizzi non validi: ${errate.join(", ")}`;

  const dati = {
    giorni_validita_prenotazione: intero("giorni_validita_prenotazione", 1, 30),
    giorni_consegna_indicativi: intero("giorni_consegna_indicativi", 1, 60),
    soglia_minima_ordine_cent: euro("soglia_minima_ordine"),
    soglia_esaurimento_default: intero("soglia_esaurimento_default", 0, 100000),
    modalita_invio_deposito: leggi(fd, "modalita_invio_deposito") === "cumulativa" ? "cumulativa" : "singola",
    orario_invio_cumulativo: orario,
    ore_sollecito_ddt: intero("ore_sollecito_ddt", 1, 720),
    prezzi_in_richiesta_evasione: Boolean(fd.get("prezzi_in_richiesta_evasione")),
    email_notifiche_admin: email,
    mesi_non_vendibile: intero("mesi_non_vendibile", 0, 60, true),
    mesi_conservazione_chat: intero("mesi_conservazione_chat", 1, 120),
    mesi_durata_residua_garantita: intero("mesi_durata_residua_garantita", 0, 36),
  };
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlla i campi evidenziati." };

  const db = await creaClientServer();
  const { data: prima } = await db.from("impostazioni").select("*").single();
  const { error } = await db.from("impostazioni").update(dati).eq("id", true);
  if (error) return { valori, messaggio: "Salvataggio non riuscito. Riprova." };
  await registraOperazione(db, utente.id, { azione: "modifica_impostazioni", entita: "impostazioni", prima, dopo: dati });
  revalidatePath("/", "layout");
  return { ok: true, valori, messaggio: "Impostazioni salvate." };
}
