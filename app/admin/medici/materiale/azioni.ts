"use server";

import { revalidatePath } from "next/cache";
import { richiediAdmin } from "@/lib/auth";
import { leggi, type StatoModulo } from "@/lib/farmacie/dati";
import { TIPI_MATERIALE } from "@/lib/medici/contenuti";
import { registraOperazione } from "@/lib/registro";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";

const MAX_BYTE = 20 * 1024 * 1024;

function aggiorna() {
  revalidatePath("/admin/medici/materiale");
  revalidatePath("/medici", "layout");
}

/**
 * 1° passo del caricamento: indirizzo firmato per mandare il PDF direttamente all'archivio privato
 * (i file fino a 20 MB non passano dal server, che su Vercel accetta richieste fino a 4,5 MB).
 */
export async function preparaCaricamento(nomeFile: string, dimensione: number): Promise<{ percorso?: string; url?: string; errore?: string }> {
  await richiediAdmin();
  if (!nomeFile.toLowerCase().endsWith(".pdf")) return { errore: "Il file deve essere un PDF" };
  if (!(dimensione > 0) || dimensione > MAX_BYTE) return { errore: "Il file supera 20 MB" };
  const percorso = `${crypto.randomUUID()}.pdf`;
  const { data, error } = await creaClientAdmin().storage.from("materiali").createSignedUploadUrl(percorso);
  if (error || !data) return { errore: "Caricamento non disponibile. Riprova." };
  return { percorso, url: data.signedUrl };
}

/** 2° passo: controlla il file arrivato nell'archivio e registra il documento (in bozza o pubblicato). */
export async function registraMateriale(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const errori: Record<string, string> = {};
  const titolo = leggi(fd, "titolo");
  const descrizione = leggi(fd, "descrizione");
  const tipo = leggi(fd, "tipo");
  const prodotto = leggi(fd, "prodotto_codice");
  const pubblicato = Boolean(fd.get("pubblicato"));
  const percorso = leggi(fd, "percorso");
  const nomeFile = leggi(fd, "file_nome");
  if (titolo.length < 2) errori.titolo = "Indica il titolo";
  if (!(tipo in TIPI_MATERIALE)) errori.tipo = "Scegli il tipo";
  if (!/^[0-9a-f-]{36}.pdf$/.test(percorso)) errori.file = "Scegli il file PDF";
  const valori = { titolo, descrizione, tipo, prodotto_codice: prodotto, pubblicato: pubblicato ? "on" : "" };
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlla i campi evidenziati." };

  // Il file deve esistere, essere un PDF (inizia con "%PDF") e non superare 20 MB
  const archivio = creaClientAdmin().storage.from("materiali");
  const { data: blob } = await archivio.download(percorso);
  const inizio = blob ? new Uint8Array(await blob.slice(0, 4).arrayBuffer()) : null;
  if (!blob || !inizio || String.fromCharCode(...inizio) !== "%PDF" || blob.size > MAX_BYTE) {
    if (blob) await archivio.remove([percorso]);
    return { errori: { file: "Il file non è un PDF valido" }, valori, messaggio: "Controlla i campi evidenziati." };
  }

  const db = await creaClientServer();
  const riga = {
    titolo,
    descrizione: descrizione || null,
    tipo,
    prodotto_codice: prodotto || null,
    file_path: percorso,
    file_nome: (nomeFile || "documento.pdf").slice(0, 200),
    dimensione_byte: blob.size,
    pubblicato,
    creato_da: utente.id,
  };
  const { data, error } = await db.from("materiali_medici").insert(riga).select("id").single();
  if (error || !data) {
    await archivio.remove([percorso]);
    return { valori, messaggio: "Salvataggio non riuscito. Riprova." };
  }
  await registraOperazione(db, utente.id, { azione: "carica_materiale_medici", entita: "materiali_medici", entitaId: data.id, dopo: riga });
  aggiorna();
  return { ok: true, messaggio: pubblicato ? "Documento caricato e pubblicato." : "Documento caricato in bozza: i medici lo vedranno dopo la pubblicazione." };
}

export async function pubblicaMateriale(id: string, pubblicato: boolean): Promise<void> {
  const utente = await richiediAdmin();
  const db = await creaClientServer();
  const { error } = await db.from("materiali_medici").update({ pubblicato }).eq("id", id);
  if (error) throw new Error("Operazione non riuscita");
  await registraOperazione(db, utente.id, { azione: pubblicato ? "pubblica_materiale_medici" : "ritira_materiale_medici", entita: "materiali_medici", entitaId: id, dopo: { pubblicato } });
  aggiorna();
}

export async function eliminaMateriale(id: string): Promise<void> {
  const utente = await richiediAdmin();
  const db = await creaClientServer();
  const { data: m } = await db.from("materiali_medici").select("*").eq("id", id).maybeSingle();
  if (!m) return;
  const { error } = await db.from("materiali_medici").delete().eq("id", id);
  if (error) throw new Error("Operazione non riuscita");
  await creaClientAdmin().storage.from("materiali").remove([m.file_path]);
  await registraOperazione(db, utente.id, { azione: "elimina_materiale_medici", entita: "materiali_medici", entitaId: id, prima: m });
  aggiorna();
}
