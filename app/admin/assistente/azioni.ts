"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { richiediAdmin, richiediStaff } from "@/lib/auth";
import { rigeneraFrammenti } from "@/lib/chat/kb";
import { normalizzaTesto } from "@/lib/chat/frammenti";
import { inviaEmail } from "@/lib/email/invia";
import { emailRispostaOperatore } from "@/lib/email/modelli-chat";
import { leggi, type StatoModulo } from "@/lib/farmacie/dati";
import { registraOperazione } from "@/lib/registro";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Pannello operatore (admin e operatori)
// ---------------------------------------------------------------------------

/** Risposta dell'operatore: compare nella stessa chat del cliente, che riceve anche un'email. */
export async function rispondiInChat(conversazioneId: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediStaff();
  const testo = leggi(fd, "testo");
  const chiudi = fd.get("chiudi") === "on";
  if (!testo) return { errori: { testo: "Scrivi la risposta" } };
  if (testo.length > 4000) return { errori: { testo: "Risposta troppo lunga (massimo 4000 caratteri)" }, valori: { testo } };

  const servizio = creaClientAdmin();
  const { data: c } = await servizio.from("conversazioni").select("id, utente_id, stato").eq("id", conversazioneId).maybeSingle();
  if (!c) return { messaggio: "Conversazione non trovata." };
  if (c.stato === "chiusa") return { messaggio: "Il cliente ha chiuso questa conversazione.", valori: { testo } };

  const { error } = await servizio.from("messaggi").insert({ conversazione_id: c.id, ruolo: "operatore", testo, autore: utente.id });
  if (error) return { messaggio: "Invio non riuscito. Riprova.", valori: { testo } };
  await servizio.from("conversazioni").update({ ultimo_messaggio_il: new Date().toISOString(), ...(chiudi ? { stato: "aperta" } : {}) }).eq("id", c.id);
  await servizio
    .from("richieste_operatore")
    .update(chiudi ? { presa_da: utente.id, stato: "chiusa", chiusa_il: new Date().toISOString() } : { presa_da: utente.id })
    .eq("conversazione_id", c.id)
    .eq("stato", "aperta");

  const { data: cliente } = await servizio.from("profili_utente").select("email, ruolo").eq("id", c.utente_id).maybeSingle();
  if (cliente?.email) await inviaEmail(emailRispostaOperatore(cliente.email, { percorso: cliente.ruolo === "privato" ? "/negozio?assistente=1" : "/farmacia?assistente=1" }));

  await registraOperazione(await creaClientServer(), utente.id, {
    azione: "risposta_chat",
    entita: "conversazioni",
    entitaId: c.id,
    dopo: { testo, richiesta_chiusa: chiudi },
  });
  revalidatePath("/admin/assistente", "layout");
  return { ok: true, messaggio: chiudi ? "Risposta inviata. Richiesta chiusa: le prossime domande tornano all'assistente." : "Risposta inviata." };
}

/** Chiude la richiesta senza rispondere: la conversazione torna all'assistente automatico. */
export async function chiudiRichiesta(conversazioneId: string) {
  const utente = await richiediStaff();
  const servizio = creaClientAdmin();
  await servizio
    .from("richieste_operatore")
    .update({ stato: "chiusa", chiusa_il: new Date().toISOString(), presa_da: utente.id })
    .eq("conversazione_id", conversazioneId)
    .eq("stato", "aperta");
  await servizio.from("conversazioni").update({ stato: "aperta" }).eq("id", conversazioneId).eq("stato", "operatore");
  await registraOperazione(await creaClientServer(), utente.id, { azione: "chiudi_richiesta_operatore", entita: "conversazioni", entitaId: conversazioneId });
  revalidatePath("/admin/assistente", "layout");
}

export async function gestisciDomanda(id: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediStaff();
  const stato = leggi(fd, "stato");
  if (!["da_valutare", "risolta", "ignorata"].includes(stato)) return { messaggio: "Stato non valido." };
  const nota = leggi(fd, "nota").slice(0, 1000) || null;
  const servizio = creaClientAdmin();
  const { error } = await servizio
    .from("domande_senza_risposta")
    .update({ stato, nota, gestita_da: utente.id, gestita_il: new Date().toISOString() })
    .eq("id", id);
  if (error) return { messaggio: "Salvataggio non riuscito." };
  await registraOperazione(await creaClientServer(), utente.id, { azione: "gestisci_domanda_chat", entita: "domande_senza_risposta", entitaId: id, dopo: { stato, nota } });
  revalidatePath("/admin/assistente/domande");
  return { ok: true, messaggio: "Salvato." };
}

// ---------------------------------------------------------------------------
// Base di conoscenza (solo admin: l'approvazione è del gruppo)
// ---------------------------------------------------------------------------
const TIPI = ["scheda_prodotto", "faq", "documento"];
const PUBBLICI = ["tutti", "farmacie", "privati", "medici"];

async function testoDaFile(file: File): Promise<string> {
  const nome = file.name.toLowerCase();
  const byte = new Uint8Array(await file.arrayBuffer());
  if (nome.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const { text } = await extractText(await getDocumentProxy(byte), { mergePages: true });
    return text;
  }
  return new TextDecoder("utf-8").decode(byte);
}

export async function salvaDocumento(id: string | null, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const valori = {
    titolo: leggi(fd, "titolo"),
    tipo: leggi(fd, "tipo"),
    pubblico: leggi(fd, "pubblico"),
    prodotto_codice: leggi(fd, "prodotto_codice"),
    testo: String(fd.get("testo") ?? ""),
  };
  const errori: Record<string, string> = {};
  const file = fd.get("file");
  let fileNome: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (!/\.(pdf|txt|md)$/i.test(file.name)) errori.file = "Carica un file PDF, TXT o MD";
    else if (file.size > 5 * 1024 * 1024) errori.file = "File troppo grande (massimo 5 MB)";
    else {
      try {
        valori.testo = await testoDaFile(file);
        fileNome = file.name;
      } catch {
        errori.file = "Non è stato possibile leggere il testo del file: incollalo nel riquadro";
      }
    }
  }
  const testo = normalizzaTesto(valori.testo);
  if (valori.titolo.length < 2) errori.titolo = "Indica un titolo";
  if (!TIPI.includes(valori.tipo)) errori.tipo = "Scegli il tipo";
  if (!PUBBLICI.includes(valori.pubblico)) errori.pubblico = "Scegli a chi è destinato";
  if (testo.length < 20) errori.testo = "Il testo è vuoto o troppo corto";
  if (testo.length > 200000) errori.testo = "Testo troppo lungo: dividilo in più documenti";

  const db = await creaClientServer();
  if (valori.prodotto_codice) {
    const { data: p } = await db.from("prodotti").select("codice").eq("codice", valori.prodotto_codice).maybeSingle();
    if (!p) errori.prodotto_codice = "Codice prodotto non trovato";
  }
  if (Object.keys(errori).length) return { errori, valori: { ...valori, testo } };

  const dati = {
    titolo: valori.titolo,
    tipo: valori.tipo,
    pubblico: valori.pubblico,
    prodotto_codice: valori.prodotto_codice || null,
    testo,
    ...(fileNome ? { file_nome: fileNome } : {}),
  };
  const { data: prima } = id ? await db.from("kb_documenti").select("titolo, tipo, pubblico, prodotto_codice, stato, versione").eq("id", id).maybeSingle() : { data: null };
  const { data, error } = id
    ? await db.from("kb_documenti").update(dati).eq("id", id).select("id, stato").single()
    : await db.from("kb_documenti").insert({ ...dati, creato_da: utente.id }).select("id, stato").single();
  if (error) return { messaggio: "Salvataggio non riuscito. Riprova.", valori: { ...valori, testo } };

  try {
    await rigeneraFrammenti(db, data.id);
  } catch (e) {
    console.error("[kb] frammenti:", e);
    return { messaggio: "Documento salvato, ma l'indicizzazione non è riuscita: salva di nuovo." };
  }
  await registraOperazione(db, utente.id, { azione: id ? "modifica_documento_kb" : "crea_documento_kb", entita: "kb_documenti", entitaId: data.id, prima, dopo: { ...dati, testo: `${testo.length} caratteri` } });
  revalidatePath("/admin/assistente/conoscenza", "layout");
  if (!id) redirect(`/admin/assistente/conoscenza/${data.id}`);
  const tornatoInBozza = prima?.stato === "approvato" && data.stato === "bozza";
  return { ok: true, messaggio: tornatoInBozza ? "Documento salvato. È tornato in bozza: va riapprovato prima che l'assistente lo usi." : "Documento salvato." };
}

export async function cambiaStatoDocumento(id: string, stato: "approvato" | "archiviato" | "bozza") {
  const utente = await richiediAdmin();
  const db = await creaClientServer();
  const { data: prima } = await db.from("kb_documenti").select("stato, versione").eq("id", id).single();
  await db
    .from("kb_documenti")
    .update(stato === "approvato" ? { stato, approvato_da: utente.id, approvato_il: new Date().toISOString() } : { stato })
    .eq("id", id);
  await registraOperazione(db, utente.id, {
    azione: stato === "approvato" ? "approva_documento_kb" : stato === "archiviato" ? "archivia_documento_kb" : "documento_kb_in_bozza",
    entita: "kb_documenti",
    entitaId: id,
    prima,
    dopo: { stato },
  });
  revalidatePath("/admin/assistente/conoscenza", "layout");
}

export async function eliminaDocumento(id: string) {
  const utente = await richiediAdmin();
  const db = await creaClientServer();
  const { data: prima } = await db.from("kb_documenti").select("titolo, stato, versione").eq("id", id).single();
  await db.from("kb_documenti").delete().eq("id", id);
  await registraOperazione(db, utente.id, { azione: "elimina_documento_kb", entita: "kb_documenti", entitaId: id, prima });
  revalidatePath("/admin/assistente/conoscenza");
  redirect("/admin/assistente/conoscenza");
}
