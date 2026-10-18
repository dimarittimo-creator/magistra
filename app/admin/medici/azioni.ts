"use server";

import { revalidatePath } from "next/cache";
import { richiediAdmin } from "@/lib/auth";
import { inviaEmail } from "@/lib/email/invia";
import { emailMedicoApprovato, emailMedicoNonAttivo } from "@/lib/email/modelli-medici";
import { leggi, valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { campiAggiornabili, leggiDatiMedico } from "@/lib/medici/dati";
import { registraOperazione } from "@/lib/registro";
import { creaClientServer } from "@/lib/supabase/server";

const ERRORE_GENERICO: StatoModulo = { messaggio: "Operazione non riuscita. Riprova tra poco." };

function aggiornaPagine(id: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/medici/${id}`);
}

async function leggiMedico(id: string) {
  const db = await creaClientServer();
  const { data } = await db.from("medici").select("*").eq("id", id).maybeSingle();
  return { db, medico: data };
}

export async function approvaMedico(id: string): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const { db, medico } = await leggiMedico(id);
  if (!medico) return ERRORE_GENERICO;
  const { error } = await db
    .from("medici")
    .update({ stato: "attivo", approvato_da: utente.id, approvato_il: new Date().toISOString(), bloccato_il: null, motivo_blocco: null })
    .eq("id", id);
  if (error) return ERRORE_GENERICO;
  const azione = medico.stato === "bloccato" ? "riattiva_medico" : "approva_medico";
  await registraOperazione(db, utente.id, { azione, entita: "medici", entitaId: id, prima: { stato: medico.stato }, dopo: { stato: "attivo" } });
  await inviaEmail(emailMedicoApprovato(medico));
  aggiornaPagine(id);
  return { ok: true, messaggio: azione === "riattiva_medico" ? "Accesso riattivato. Il medico riceverà un'email." : "Accesso approvato. Il medico riceverà un'email." };
}

export async function bloccaMedico(id: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const motivo = leggi(fd, "motivo_blocco");
  const { db, medico } = await leggiMedico(id);
  if (!medico) return ERRORE_GENERICO;
  const { error } = await db.from("medici").update({ stato: "bloccato", bloccato_il: new Date().toISOString(), motivo_blocco: motivo || null }).eq("id", id);
  if (error) return ERRORE_GENERICO;
  await registraOperazione(db, utente.id, {
    azione: medico.stato === "in_attesa" ? "rifiuta_medico" : "blocca_medico",
    entita: "medici",
    entitaId: id,
    prima: { stato: medico.stato },
    dopo: { stato: "bloccato", motivo_blocco: motivo || null },
  });
  if (fd.get("avvisa")) await inviaEmail(emailMedicoNonAttivo(medico, motivo || null));
  aggiornaPagine(id);
  return { ok: true, messaggio: medico.stato === "in_attesa" ? "Richiesta rifiutata." : "Accesso bloccato: il medico non vede più i contenuti riservati." };
}

export async function salvaDatiMedicoAdmin(id: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const valori = valoriModulo(fd);
  const { dati, errori } = leggiDatiMedico(fd, { identificativi: true });
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlla i campi evidenziati." };
  const { db, medico } = await leggiMedico(id);
  if (!medico) return ERRORE_GENERICO;
  const modifiche = {
    ...campiAggiornabili(dati),
    nome: dati.nome,
    cognome: dati.cognome,
    numero_iscrizione: dati.numero_iscrizione,
    ordine_provincia: dati.ordine_provincia,
    note_admin: leggi(fd, "note_admin") || null,
  };
  const { error } = await db.from("medici").update(modifiche).eq("id", id);
  if (error) {
    if (error.code === "23505") return { valori, errori: { numero_iscrizione: "Iscrizione già presente per un altro medico" }, messaggio: "Controlla i campi evidenziati." };
    return { ...ERRORE_GENERICO, valori };
  }
  await registraOperazione(db, utente.id, { azione: "modifica_dati_medico", entita: "medici", entitaId: id, prima: medico, dopo: modifiche });
  aggiornaPagine(id);
  return { ok: true, valori, messaggio: "Dati del medico salvati." };
}
