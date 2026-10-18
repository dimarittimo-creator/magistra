"use server";

import { revalidatePath } from "next/cache";
import { richiediStaff } from "@/lib/auth";
import { inviaEmail } from "@/lib/email/invia";
import { emailEsitoCampioni } from "@/lib/email/modelli-medici";
import { leggi, type StatoModulo } from "@/lib/farmacie/dati";
import { registraOperazione } from "@/lib/registro";
import { creaClientServer } from "@/lib/supabase/server";

const STATI = ["in_lavorazione", "spedita", "non_accolta"];

/** Cambia lo stato di una richiesta di campioni e avvisa il medico via email. */
export async function aggiornaRichiestaCampioni(id: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediStaff();
  const stato = leggi(fd, "stato");
  const messaggio = leggi(fd, "messaggio_admin");
  if (!STATI.includes(stato)) return { messaggio: "Scegli il nuovo stato." };
  if (messaggio.length > 1000) return { messaggio: "Messaggio troppo lungo (massimo 1000 caratteri)." };

  const db = await creaClientServer();
  const { data: r } = await db
    .from("richieste_campioni")
    .select("id, stato, prodotto_nome, quantita, note, medico:medico_id(nome, cognome, email)")
    .eq("id", id)
    .maybeSingle();
  if (!r) return { messaggio: "Richiesta non trovata." };
  const { error } = await db
    .from("richieste_campioni")
    .update({ stato, messaggio_admin: messaggio || null, gestita_da: utente.id })
    .eq("id", id);
  if (error) return { messaggio: "Operazione non riuscita. Riprova." };

  await registraOperazione(db, utente.id, {
    azione: "aggiorna_richiesta_campioni",
    entita: "richieste_campioni",
    entitaId: id,
    prima: { stato: r.stato },
    dopo: { stato, messaggio_admin: messaggio || null },
  });
  const medico = r.medico as unknown as { nome: string; cognome: string; email: string } | null;
  if (medico && fd.get("avvisa")) await inviaEmail(emailEsitoCampioni(medico, r, stato, messaggio || null));
  revalidatePath("/admin/medici/campioni");
  return { ok: true, messaggio: "Richiesta aggiornata." };
}
