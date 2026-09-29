"use server";

import { revalidatePath } from "next/cache";
import { richiediAdmin } from "@/lib/auth";
import { inviaEmail } from "@/lib/email/invia";
import { emailAccountBloccato, emailIscrizioneApprovata } from "@/lib/email/modelli";
import { leggi, leggiDatiFarmacia, valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { indirizzoDi, leggiFarmacia } from "@/lib/farmacie/lettura";
import { aggiornaFarmacia } from "@/lib/farmacie/salvataggio";
import { registraOperazione } from "@/lib/registro";
import { creaClientServer } from "@/lib/supabase/server";

const ERRORE_GENERICO: StatoModulo = { messaggio: "Operazione non riuscita. Riprova tra poco." };

function aggiornaPagine(id: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/farmacie/${id}`);
}

export async function approvaFarmacia(id: string): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const db = await creaClientServer();
  const prima = await leggiFarmacia(db, id);
  if (!prima) return ERRORE_GENERICO;

  const modifiche = {
    stato: "attiva",
    approvata_da: utente.id,
    approvata_il: new Date().toISOString(),
    bloccata_il: null,
    motivo_blocco: null,
  };
  const { error } = await db.from("farmacie").update(modifiche).eq("id", id);
  if (error) return ERRORE_GENERICO;

  const azione = prima.stato === "bloccata" ? "riattiva_farmacia" : "approva_farmacia";
  await registraOperazione(db, utente.id, {
    azione,
    entita: "farmacie",
    entitaId: id,
    prima: { stato: prima.stato },
    dopo: { stato: "attiva" },
  });
  await inviaEmail(emailIscrizioneApprovata(prima));
  aggiornaPagine(id);
  return { ok: true, messaggio: azione === "riattiva_farmacia" ? "Farmacia riattivata. Le abbiamo inviato un'email." : "Iscrizione approvata. La farmacia riceverà un'email." };
}

export async function bloccaFarmacia(id: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const motivo = leggi(fd, "motivo_blocco");
  const db = await creaClientServer();
  const prima = await leggiFarmacia(db, id);
  if (!prima) return ERRORE_GENERICO;

  const { error } = await db
    .from("farmacie")
    .update({ stato: "bloccata", bloccata_il: new Date().toISOString(), motivo_blocco: motivo || null })
    .eq("id", id);
  if (error) return ERRORE_GENERICO;

  await registraOperazione(db, utente.id, {
    azione: prima.stato === "in_attesa" ? "rifiuta_farmacia" : "blocca_farmacia",
    entita: "farmacie",
    entitaId: id,
    prima: { stato: prima.stato },
    dopo: { stato: "bloccata", motivo_blocco: motivo || null },
  });
  if (fd.get("avvisa")) await inviaEmail(emailAccountBloccato(prima, motivo || null));
  aggiornaPagine(id);
  return { ok: true, messaggio: "Farmacia bloccata: non vede più prezzi e disponibilità." };
}

export async function salvaCondizioniFarmacia(id: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const db = await creaClientServer();
  const prima = await leggiFarmacia(db, id);
  if (!prima) return ERRORE_GENERICO;

  const modifiche = {
    gruppo_id: leggi(fd, "gruppo_id") || null,
    societa_predefinita_id: leggi(fd, "societa_predefinita_id") || null,
    note_admin: leggi(fd, "note_admin") || null,
  };
  const { error } = await db.from("farmacie").update(modifiche).eq("id", id);
  if (error) return ERRORE_GENERICO;

  await registraOperazione(db, utente.id, {
    azione: "modifica_condizioni_farmacia",
    entita: "farmacie",
    entitaId: id,
    prima: { gruppo_id: prima.gruppo_id, societa_predefinita_id: prima.societa_predefinita_id, note_admin: prima.note_admin },
    dopo: modifiche,
  });
  aggiornaPagine(id);
  return { ok: true, messaggio: "Impostazioni salvate." };
}

export async function salvaDatiFarmaciaAdmin(id: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const valori = valoriModulo(fd);
  const { dati, consegna, fatturazione, errori } = leggiDatiFarmacia(fd, { identificativi: true });
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlla i campi evidenziati." };

  const db = await creaClientServer();
  const prima = await leggiFarmacia(db, id);
  if (!prima) return ERRORE_GENERICO;

  const esito = await aggiornaFarmacia(db, id, dati, consegna, fatturazione);
  if (esito.errore) {
    if (esito.codice === "23505") return { valori, errori: { codice_farmacia: "Codice già usato da un'altra farmacia" }, messaggio: "Controlla i campi evidenziati." };
    return { ...ERRORE_GENERICO, valori };
  }

  await registraOperazione(db, utente.id, {
    azione: "modifica_dati_farmacia",
    entita: "farmacie",
    entitaId: id,
    prima: { ...prima, indirizzi: undefined, consegna: indirizzoDi(prima, "consegna"), fatturazione: indirizzoDi(prima, "fatturazione") },
    dopo: { ...dati, consegna, fatturazione },
  });
  aggiornaPagine(id);
  return { ok: true, valori, messaggio: "Dati della farmacia salvati." };
}
