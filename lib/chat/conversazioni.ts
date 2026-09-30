import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aggiungiLottoAlCarrello } from "@/lib/carrello";
import { chiediAlModello, type Modalita } from "@/lib/chat/modello";
import { BENVENUTO, ISTRUZIONI_FARMACIE, contestoFarmacia } from "@/lib/chat/prompt";
import { InputNonValido, STRUMENTI, catalogoPigro, eseguiStrumento, type ContestoStrumenti } from "@/lib/chat/strumenti";
import { oggiRoma } from "@/lib/date";
import { emailAmministrazione } from "@/lib/email/destinatari";
import { inviaEmail } from "@/lib/email/invia";
import { emailRichiestaOperatore } from "@/lib/email/modelli-chat";
import { formattaData } from "@/lib/formato";
import { creaClientAdmin } from "@/lib/supabase/admin";

// Conversazioni dell'assistente (indipendenti dal canale: la futura versione vocale userà
// le stesse funzioni, cambiando solo come arriva la domanda e come si presenta la risposta).
// Le scritture passano dal client di servizio dopo i controlli; le letture dell'utente dalla RLS.

export const LIMITI = {
  lunghezzaMessaggio: 2000,
  messaggiPer5Minuti: 15,
  messaggiAlGiorno: 200,
  messaggiPerConversazione: 120,
  giriStrumenti: 8,
};

export type VistaProposta = {
  id: string;
  prodotto_nome: string;
  codice_lotto: string;
  scadenza: string | null;
  quantita: number;
  stato: "in_attesa" | "confermata" | "annullata" | "non_valida";
  esito: string | null;
};

export type VistaMessaggio = { id: number; ruolo: "utente" | "assistente" | "operatore"; testo: string; creato_il: string; proposte: VistaProposta[] };

export type VistaConversazione = {
  id: string;
  stato: "aperta" | "operatore" | "chiusa";
  modalita: Modalita;
  richiestaAperta: boolean;
  messaggi: VistaMessaggio[];
};

type Conversazione = { id: string; utente_id: string; farmacia_id: string | null; stato: VistaConversazione["stato"]; modalita: Modalita };

export class ErroreChat extends Error {}

// ---------------------------------------------------------------------------
// Lettura (client dell'utente o dello staff: vale la RLS)
// ---------------------------------------------------------------------------
export async function leggiConversazione(db: SupabaseClient, id: string): Promise<VistaConversazione | null> {
  const [{ data: c }, { data: messaggi }, { data: proposte }, { data: richiesta }] = await Promise.all([
    db.from("conversazioni").select("id, stato, modalita").eq("id", id).maybeSingle(),
    db.from("messaggi").select("id, ruolo, testo, creato_il").eq("conversazione_id", id).order("id"),
    db.from("proposte_carrello").select("id, messaggio_id, prodotto_nome, codice_lotto, scadenza, quantita, stato, esito").eq("conversazione_id", id).order("creata_il"),
    db.from("richieste_operatore").select("id").eq("conversazione_id", id).eq("stato", "aperta").maybeSingle(),
  ]);
  if (!c) return null;
  const perMessaggio = Map.groupBy((proposte ?? []) as (VistaProposta & { messaggio_id: number | null })[], (p) => p.messaggio_id);
  return {
    id: c.id,
    stato: c.stato,
    modalita: c.modalita,
    richiestaAperta: !!richiesta,
    messaggi: ((messaggi ?? []) as Omit<VistaMessaggio, "proposte">[]).map((m) => ({
      ...m,
      proposte: (perMessaggio.get(m.id) ?? []).map(({ messaggio_id: _, ...p }) => p),
    })),
  };
}

/** Conversazione in corso dell'utente (la più recente non chiusa), se c'è. */
export async function conversazioneInCorso(db: SupabaseClient, utenteId: string): Promise<VistaConversazione | null> {
  const { data } = await db
    .from("conversazioni")
    .select("id")
    .eq("utente_id", utenteId)
    .neq("stato", "chiusa")
    .order("ultimo_messaggio_il", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? leggiConversazione(db, data.id) : null;
}

// ---------------------------------------------------------------------------
// Scritture
// ---------------------------------------------------------------------------
async function caricaPropria(servizio: SupabaseClient, conversazioneId: string, utenteId: string): Promise<Conversazione> {
  const { data } = await servizio.from("conversazioni").select("id, utente_id, farmacia_id, stato, modalita").eq("id", conversazioneId).maybeSingle();
  if (!data || data.utente_id !== utenteId) throw new ErroreChat("Conversazione non trovata.");
  if (data.stato === "chiusa") throw new ErroreChat("Questa conversazione è chiusa: iniziane una nuova.");
  return data as Conversazione;
}

async function aggiungiMessaggio(
  servizio: SupabaseClient,
  conversazioneId: string,
  m: { ruolo: VistaMessaggio["ruolo"]; testo: string; api?: unknown; strumenti?: string[]; autore?: string; token?: { input_tokens: number; output_tokens: number } },
): Promise<number> {
  const { data, error } = await servizio
    .from("messaggi")
    .insert({
      conversazione_id: conversazioneId,
      ruolo: m.ruolo,
      testo: m.testo,
      api: m.api ?? null,
      strumenti: m.strumenti ?? [],
      autore: m.autore ?? null,
      token_ingresso: m.token?.input_tokens ?? null,
      token_uscita: m.token?.output_tokens ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await servizio.from("conversazioni").update({ ultimo_messaggio_il: new Date().toISOString() }).eq("id", conversazioneId);
  return data.id as number;
}

/** Apre una conversazione dopo che la farmacia ha letto l'informativa. */
export async function iniziaConversazione(opzioni: { utenteId: string; farmaciaId: string; modalita: Modalita }): Promise<string> {
  const servizio = creaClientAdmin();
  // Una sola conversazione aperta per utente: le precedenti si chiudono (restano nello storico)
  await servizio.from("conversazioni").update({ stato: "chiusa", chiusa_il: new Date().toISOString() }).eq("utente_id", opzioni.utenteId).eq("stato", "aperta");
  const { data, error } = await servizio
    .from("conversazioni")
    .insert({ utente_id: opzioni.utenteId, farmacia_id: opzioni.farmaciaId, modalita: opzioni.modalita })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await aggiungiMessaggio(servizio, data.id, {
    ruolo: "assistente",
    testo:
      opzioni.modalita === "solo_operatore"
        ? "Buongiorno! L'assistente automatico al momento non è attivo: scriva pure la sua domanda, la inoltro a un operatore di Magistra che le risponderà qui."
        : BENVENUTO,
  });
  return data.id;
}

export async function chiudiConversazione(utenteId: string, conversazioneId: string): Promise<void> {
  const servizio = creaClientAdmin();
  await caricaPropria(servizio, conversazioneId, utenteId);
  const { data: aperta } = await servizio.from("richieste_operatore").select("id").eq("conversazione_id", conversazioneId).eq("stato", "aperta").maybeSingle();
  if (aperta) throw new ErroreChat("Un operatore deve ancora risponderle in questa conversazione: attenda la risposta prima di iniziarne una nuova.");
  await servizio.from("conversazioni").update({ stato: "chiusa", chiusa_il: new Date().toISOString() }).eq("id", conversazioneId);
}

/** Limiti di frequenza (docs/CONFORMITA.md): messaggi dell'utente negli ultimi 5 minuti e nelle ultime 24 ore. */
async function controllaFrequenza(servizio: SupabaseClient, utenteId: string): Promise<void> {
  const conta = async (minuti: number) => {
    const { count } = await servizio
      .from("messaggi")
      .select("id, conversazioni!inner(utente_id)", { count: "exact", head: true })
      .eq("conversazioni.utente_id", utenteId)
      .eq("ruolo", "utente")
      .gte("creato_il", new Date(Date.now() - minuti * 60_000).toISOString());
    return count ?? 0;
  };
  if ((await conta(5)) >= LIMITI.messaggiPer5Minuti) throw new ErroreChat("Sta scrivendo molti messaggi in poco tempo: attenda qualche minuto e riprovi.");
  if ((await conta(24 * 60)) >= LIMITI.messaggiAlGiorno) throw new ErroreChat("Ha raggiunto il numero massimo di messaggi per oggi. Per urgenze contatti l'assistenza.");
}

/** Passa la conversazione a un operatore: richiesta aperta, avviso email agli admin (una volta per richiesta). */
export async function passaAOperatore(servizio: SupabaseClient, c: Pick<Conversazione, "id" | "farmacia_id">, motivo: string): Promise<boolean> {
  const { data: aperta } = await servizio.from("richieste_operatore").select("id").eq("conversazione_id", c.id).eq("stato", "aperta").maybeSingle();
  await servizio.from("conversazioni").update({ stato: "operatore" }).eq("id", c.id);
  if (aperta) return false;
  const { error } = await servizio.from("richieste_operatore").insert({ conversazione_id: c.id, motivo: motivo.slice(0, 500) });
  if (error) return false; // richiesta aperta nel frattempo da un'altra chiamata
  const [{ data: farmacia }, { data: ultimo }] = await Promise.all([
    c.farmacia_id ? servizio.from("farmacie").select("ragione_sociale, codice_farmacia").eq("id", c.farmacia_id).maybeSingle() : Promise.resolve({ data: null }),
    servizio.from("messaggi").select("testo").eq("conversazione_id", c.id).eq("ruolo", "utente").order("id", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const cliente = farmacia ? `${farmacia.ragione_sociale}${farmacia.codice_farmacia ? ` (${farmacia.codice_farmacia})` : ""}` : "Cliente";
  await inviaEmail(emailRichiestaOperatore(await emailAmministrazione(), { conversazioneId: c.id, cliente, motivo, ultimoMessaggio: ultimo?.testo ?? "" }));
  return true;
}

/** La farmacia chiede direttamente un operatore (pulsante nella chat). */
export async function chiediOperatore(utenteId: string, conversazioneId: string): Promise<void> {
  const servizio = creaClientAdmin();
  const c = await caricaPropria(servizio, conversazioneId, utenteId);
  const nuova = await passaAOperatore(servizio, c, "La farmacia ha chiesto di parlare con un operatore");
  if (nuova) {
    await aggiungiMessaggio(servizio, c.id, {
      ruolo: "assistente",
      testo: "Ho avvisato un operatore di Magistra: le risponderà in questa chat appena possibile (in orario d'ufficio). Può chiudere la pagina, riceverà anche un'email.",
    });
  }
}

/**
 * Note da far sapere al modello nel turno successivo: risposte dell'operatore e decisioni sulle proposte
 * arrivate dopo l'ultimo messaggio già inviato al modello. Diventano parte del nuovo messaggio dell'utente,
 * così la storia inviata resta sempre identica (si aggiunge soltanto, non si modifica mai).
 */
async function noteIntermedie(servizio: SupabaseClient, conversazioneId: string): Promise<string[]> {
  const { data: ultimoApi } = await servizio
    .from("messaggi")
    .select("id, creato_il")
    .eq("conversazione_id", conversazioneId)
    .not("api", "is", null)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const [{ data: scambi }, { data: proposte }] = await Promise.all([
    // Messaggi scambiati con l'operatore (non passati dal modello)
    servizio
      .from("messaggi")
      .select("ruolo, testo")
      .eq("conversazione_id", conversazioneId)
      .in("ruolo", ["utente", "operatore"])
      .is("api", null)
      .gt("id", ultimoApi?.id ?? 0)
      .order("id"),
    servizio
      .from("proposte_carrello")
      .select("prodotto_nome, codice_lotto, quantita, stato, esito")
      .eq("conversazione_id", conversazioneId)
      .neq("stato", "in_attesa")
      .gt("decisa_il", ultimoApi?.creato_il ?? "1970-01-01"),
  ]);
  const note = (scambi ?? []).map((m) =>
    m.ruolo === "operatore" ? `[Risposta dell'operatore di Magistra: ${m.testo}]` : `[Messaggio della farmacia all'operatore: ${m.testo}]`,
  );
  for (const p of proposte ?? []) {
    const cosa = `${p.quantita} pezzi di ${p.prodotto_nome}, lotto ${p.codice_lotto}`;
    note.push(
      p.stato === "confermata"
        ? `[La farmacia ha confermato la proposta: ${cosa} aggiunti al carrello]`
        : p.stato === "annullata"
          ? `[La farmacia ha annullato la proposta: ${cosa}]`
          : `[Proposta non più valida: ${cosa}. ${p.esito ?? ""}]`,
    );
  }
  return note;
}

const RISPOSTA_ERRORE = "Al momento non riesco a rispondere. Riprovi tra qualche minuto oppure prema «Parla con un operatore».";
const RISPOSTA_RIFIUTO = "Su questa richiesta non posso aiutarla. Se ha bisogno, prema «Parla con un operatore».";

/** Un messaggio della farmacia e la risposta dell'assistente (con gli strumenti necessari). */
export async function inviaMessaggio(opzioni: {
  db: SupabaseClient;
  utenteId: string;
  farmaciaId: string;
  nomeFarmacia: string;
  conversazioneId: string;
  testo: string;
}): Promise<void> {
  const testo = opzioni.testo.trim();
  if (!testo) throw new ErroreChat("Scriva un messaggio.");
  if (testo.length > LIMITI.lunghezzaMessaggio) throw new ErroreChat(`Il messaggio è troppo lungo (massimo ${LIMITI.lunghezzaMessaggio} caratteri).`);

  const servizio = creaClientAdmin();
  const c = await caricaPropria(servizio, opzioni.conversazioneId, opzioni.utenteId);
  if (c.farmacia_id !== opzioni.farmaciaId) throw new ErroreChat("Conversazione non trovata.");
  await controllaFrequenza(servizio, opzioni.utenteId);
  const { count } = await servizio.from("messaggi").select("id", { count: "exact", head: true }).eq("conversazione_id", c.id);
  if ((count ?? 0) >= LIMITI.messaggiPerConversazione) throw new ErroreChat("Questa conversazione è molto lunga: prema «Nuova conversazione» per continuare.");

  // Con un operatore al lavoro (o senza assistente automatico) il messaggio va solo all'operatore.
  if (c.stato === "operatore" || c.modalita === "solo_operatore") {
    await aggiungiMessaggio(servizio, c.id, { ruolo: "utente", testo });
    if (c.stato !== "operatore") {
      await passaAOperatore(servizio, c, testo);
      await aggiungiMessaggio(servizio, c.id, { ruolo: "assistente", testo: "Grazie, ho inoltrato la sua domanda a un operatore: le risponderà qui appena possibile." });
    }
    return;
  }

  const note = await noteIntermedie(servizio, c.id);
  const messaggioUtente: Anthropic.Beta.BetaMessageParam = {
    role: "user",
    content: [...note.map((n) => ({ type: "text" as const, text: n })), { type: "text", text: testo }],
  };
  await aggiungiMessaggio(servizio, c.id, { ruolo: "utente", testo, api: [messaggioUtente] });

  const { data: righe } = await servizio.from("messaggi").select("api").eq("conversazione_id", c.id).not("api", "is", null).order("id");
  const storia = (righe ?? []).flatMap((r) => r.api as Anthropic.Beta.BetaMessageParam[]);

  const effetti: ContestoStrumenti["effetti"] = { proposte: [], operatore: false };
  const ctx = {
    db: opzioni.db,
    servizio,
    farmaciaId: opzioni.farmaciaId,
    conversazioneId: c.id,
    effetti,
    passaAOperatore: async (motivo: string) => void (await passaAOperatore(servizio, c, motivo)),
    catalogo: catalogoPigro(opzioni.db, opzioni.farmaciaId),
  };
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: ISTRUZIONI_FARMACIE, cache_control: { type: "ephemeral" } },
    { type: "text", text: contestoFarmacia({ oggi: formattaData(oggiRoma()), farmacia: opzioni.nomeFarmacia }) },
  ];

  const turno: Anthropic.Beta.BetaMessageParam[] = [];
  const strumentiUsati: string[] = [];
  const token = { input_tokens: 0, output_tokens: 0 };
  let risposta: string | null = null;
  let completo = false;

  try {
    for (let giro = 0; giro < LIMITI.giriStrumenti; giro++) {
      const r = await chiediAlModello(c.modalita, { system, tools: STRUMENTI, messages: [...storia, ...turno] });
      token.input_tokens += r.usage.input_tokens;
      token.output_tokens += r.usage.output_tokens;
      turno.push({ role: "assistant", content: r.content as Anthropic.Beta.BetaContentBlockParam[] });

      if (r.stop_reason === "refusal") {
        risposta = RISPOSTA_RIFIUTO;
        break;
      }
      if (r.stop_reason === "max_tokens") break;

      const usi = r.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (r.stop_reason !== "tool_use" || usi.length === 0) {
        risposta = r.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n\n").trim() || null;
        completo = !!risposta;
        break;
      }

      // Tutti i risultati in un unico messaggio, anche quelli con errore.
      const risultati = await Promise.all(
        usi.map(async (uso): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
          strumentiUsati.push(uso.name);
          try {
            const input = uso.input && typeof uso.input === "object" ? (uso.input as Record<string, unknown>) : {};
            const esito = await eseguiStrumento(uso.name, input, ctx);
            return { type: "tool_result", tool_use_id: uso.id, content: JSON.stringify(esito) };
          } catch (e) {
            if (!(e instanceof InputNonValido)) console.error(`[assistente] strumento ${uso.name}:`, e);
            const motivo = e instanceof InputNonValido ? e.message : "Errore temporaneo nel leggere i dati";
            return { type: "tool_result", tool_use_id: uso.id, content: `INVALID_INPUT o errore: ${motivo}`, is_error: true };
          }
        }),
      );
      turno.push({ role: "user", content: risultati });
    }
  } catch (e) {
    console.error("[assistente] chiamata al modello non riuscita:", e);
  }

  // Si rimanda al modello solo un turno completo (finito con una risposta di testo):
  // un turno interrotto resterebbe con strumenti senza risultato.
  const idMessaggio = await aggiungiMessaggio(servizio, c.id, {
    ruolo: "assistente",
    testo: risposta ?? RISPOSTA_ERRORE,
    api: completo ? turno : null,
    strumenti: [...new Set(strumentiUsati)],
    token,
  });
  if (effetti.proposte.length) {
    await servizio.from("proposte_carrello").update({ messaggio_id: idMessaggio }).in("id", effetti.proposte);
  }
}

/** Conferma o annulla una proposta: solo qui la merce entra davvero nel carrello. */
export async function decidiProposta(opzioni: { db: SupabaseClient; utenteId: string; farmaciaId: string; propostaId: string; conferma: boolean }): Promise<string> {
  const servizio = creaClientAdmin();
  const { data: p } = await servizio
    .from("proposte_carrello")
    .select("id, conversazione_id, farmacia_id, lotto_id, quantita, stato, creata_il, conversazioni!inner(utente_id)")
    .eq("id", opzioni.propostaId)
    .maybeSingle();
  const proprietario = (p?.conversazioni as unknown as { utente_id: string } | undefined)?.utente_id;
  if (!p || proprietario !== opzioni.utenteId || p.farmacia_id !== opzioni.farmaciaId) throw new ErroreChat("Proposta non trovata.");
  if (p.stato !== "in_attesa") throw new ErroreChat("Questa proposta è già stata gestita.");

  const decisa = { decisa_il: new Date().toISOString() };
  if (!opzioni.conferma) {
    await servizio.from("proposte_carrello").update({ stato: "annullata", ...decisa }).eq("id", p.id);
    return "Proposta annullata: il carrello non è cambiato.";
  }
  if (Date.now() - new Date(p.creata_il).getTime() > 24 * 3600_000) {
    await servizio.from("proposte_carrello").update({ stato: "non_valida", esito: "Proposta scaduta", ...decisa }).eq("id", p.id);
    throw new ErroreChat("La proposta è di ieri o prima: chieda di nuovo all'assistente, così verifica la disponibilità di oggi.");
  }
  // Stessi controlli del catalogo, con i permessi della farmacia
  const esito = await aggiungiLottoAlCarrello(opzioni.db, opzioni.farmaciaId, p.lotto_id, p.quantita);
  await servizio
    .from("proposte_carrello")
    .update({ stato: esito.ok ? "confermata" : "non_valida", esito: esito.messaggio, ...decisa })
    .eq("id", p.id);
  if (!esito.ok) throw new ErroreChat(esito.messaggio);
  return esito.messaggio;
}
