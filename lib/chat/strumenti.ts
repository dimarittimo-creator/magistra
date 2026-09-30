import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ETICHETTE_STATO_PRODOTTO } from "@/lib/availability";
import { caricaCatalogo, type Catalogo, type LottoCatalogo, type ProdottoCatalogo } from "@/lib/catalogo";
import { cercaKb } from "@/lib/chat/kb";
import { documentoCorrente } from "@/lib/documenti-legali";
import { formattaData, formattaEuro } from "@/lib/formato";
import { ETICHETTE_STATO_ORDINE, type StatoOrdine } from "@/lib/ordini/stati";
import { descriviPromozione, type Promozione } from "@/lib/promozioni";

// Strumenti dell'assistente per le farmacie (docs/SPECIFICA.md §6).
// Regola: disponibilità, prezzi, promozioni e ordini arrivano SOLO da qui, cioè dal database,
// letti con il client della farmacia collegata (la Row Level Security vale anche per l'assistente).
// Nessuno strumento mette merce nel carrello: si crea una proposta che la farmacia conferma con un pulsante.
// Ogni risultato ha un "riepilogo" in italiano semplice, più i dati utili.

export type ContestoStrumenti = {
  /** Client dell'utente collegato (RLS) */
  db: SupabaseClient;
  /** Client di servizio: solo per scrivere proposte, domande e richieste della chat */
  servizio: SupabaseClient;
  farmaciaId: string;
  conversazioneId: string;
  /** Effetti del turno, per l'interfaccia */
  effetti: { proposte: string[]; operatore: boolean };
  passaAOperatore: (motivo: string) => Promise<void>;
};

export type EsitoStrumento = { riepilogo: string; [chiave: string]: unknown };

type Proprieta = Record<string, { type: "string" | "integer"; description: string }>;

function definizione(name: string, description: string, proprieta: Proprieta): Anthropic.Beta.BetaTool {
  return {
    name,
    description,
    input_schema: { type: "object", properties: proprieta, required: Object.keys(proprieta), additionalProperties: false },
    eager_input_streaming: true,
  };
}

export const STRUMENTI: Anthropic.Beta.BetaTool[] = [
  definizione(
    "cerca_prodotti",
    "Cerca i prodotti del catalogo Magistra visibili a questa farmacia, per nome, codice, linea o area. Restituisce stato di disponibilità, pezzi disponibili e miglior prezzo farmacia. Usalo prima di parlare di qualsiasi prodotto: se un prodotto non compare qui, per il portale non esiste. Testo vuoto = elenco completo.",
    { testo: { type: "string", description: "Parole da cercare (es. 'magnesio', 'linea Bioeleva'); stringa vuota per tutto il catalogo" } },
  ),
  definizione(
    "dettaglio_prodotto",
    "Lotti disponibili di un prodotto con scadenza, pezzi disponibili, sconto applicato e sua origine, prezzo farmacia IVA esclusa, promozioni di merce; più minimo d'ordine, multiplo e descrizione del prodotto.",
    { codice: { type: "string", description: "Codice del prodotto (da cerca_prodotti)" } },
  ),
  definizione("promozioni_attive", "Promozioni attive oggi che valgono per questa farmacia, con i prodotti interessati e la data di fine.", {}),
  definizione(
    "stato_ordini",
    "Ordini (prenotazioni) di questa farmacia: numero, data, stato, totale, società che fattura, spedizione. Con un numero d'ordine restituisce solo quello; con stringa vuota gli ultimi 10.",
    { numero: { type: "string", description: "Numero d'ordine, es. P-2026-00052; stringa vuota per gli ultimi ordini" } },
  ),
  definizione(
    "informazioni_vendita",
    "Condizioni di vendita per le farmacie lette dal portale: ordine minimo, validità della prenotazione, tempi di consegna indicativi, trasporto, modalità di pagamento consentite a questa farmacia, società che possono fatturare e testo delle condizioni di vendita.",
    {},
  ),
  definizione(
    "cerca_informazioni",
    "Cerca nella base di conoscenza approvata da Sagè Pharma e Bioeleva (schede prodotto, composizione, formato, modo d'uso, avvertenze, FAQ, materiale informativo). È l'UNICA fonte ammessa per le informazioni sui prodotti.",
    { domanda: { type: "string", description: "La domanda o le parole chiave da cercare" } },
  ),
  definizione(
    "proponi_aggiunta_carrello",
    "Prepara una PROPOSTA di aggiunta al carrello: la farmacia vedrà un riquadro con i pulsanti «Conferma» e «Annulla». Non aggiunge nulla da solo. Se codice_lotto è vuoto sceglie il lotto vendibile con il prezzo farmacia più basso che ha abbastanza pezzi.",
    {
      codice_prodotto: { type: "string", description: "Codice del prodotto" },
      quantita: { type: "integer", description: "Numero di pezzi da acquistare (senza omaggi)" },
      codice_lotto: { type: "string", description: "Codice del lotto scelto; stringa vuota per il lotto più conveniente" },
    },
  ),
  definizione(
    "passa_a_operatore",
    "Passa la conversazione a un operatore di Sagè Pharma, che riceve un avviso e risponde in questa stessa chat. Usalo quando la farmacia lo chiede, o quando non trovi la risposta e la farmacia vuole essere aiutata da una persona.",
    { motivo: { type: "string", description: "Riassunto breve di cosa serve alla farmacia" } },
  ),
  definizione(
    "registra_domanda_senza_risposta",
    "Registra una domanda a cui non sai rispondere con gli strumenti e la base di conoscenza, così il gruppo può aggiungere l'informazione mancante.",
    { domanda: { type: "string", description: "La domanda della farmacia, riformulata in modo chiaro" } },
  ),
];

// ---------------------------------------------------------------------------
// Controllo degli input (con lo streaming dei parametri il modello può mandarli incompleti)
// ---------------------------------------------------------------------------
export class InputNonValido extends Error {}

function testo(input: Record<string, unknown>, chiave: string, max = 500): string {
  const v = input[chiave];
  if (typeof v !== "string") throw new InputNonValido(`Il parametro «${chiave}» deve essere un testo`);
  return v.trim().slice(0, max);
}

function intero(input: Record<string, unknown>, chiave: string): number {
  const v = input[chiave];
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0 || v > 100000) throw new InputNonValido(`Il parametro «${chiave}» deve essere un numero intero positivo`);
  return v;
}

const minuscolo = (s: string) => s.toLocaleLowerCase("it-IT").normalize("NFD").replace(/[̀-ͯ]/g, "");

// ---------------------------------------------------------------------------
// Descrizioni
// ---------------------------------------------------------------------------
const ORIGINE_SCONTO: Record<string, string> = {
  fascia: "fascia di scadenza",
  lotto: "sconto del lotto",
  promozione: "promozione",
  listino_gruppo: "listino riservato del gruppo",
};

function descriviLotto(l: LottoCatalogo) {
  return {
    codice_lotto: l.codice_lotto,
    scadenza: l.scadenza ? formattaData(l.scadenza) : "non indicata",
    stato: l.stato === "vendibile" ? "disponibile" : l.stato === "esaurito" ? "esaurito (tutto prenotato)" : "non disponibile",
    pezzi_disponibili: l.disponibile,
    sconto_percentuale: l.sconto?.sconto ?? null,
    origine_sconto: l.sconto ? ORIGINE_SCONTO[l.sconto.origine] ?? l.sconto.origine : null,
    prezzo_farmacia_iva_esclusa: l.prezzi ? formattaEuro(l.prezzi.farmaciaNettoCent) : null,
    prezzo_farmacia_iva_inclusa: l.prezzi ? formattaEuro(l.prezzi.farmaciaIvatoCent) : null,
    promozioni_merce: l.promoMerce.map((p) => `${p.nome}: ${descriviPromozione(p)}`),
  };
}

function descriviProdotto(p: ProdottoCatalogo) {
  return {
    codice: p.codice,
    nome: p.nome,
    formato: p.formato,
    linea: p.linea?.nome ?? null,
    area: p.area?.nome ?? null,
    stato: ETICHETTE_STATO_PRODOTTO[p.stato].testo,
    pezzi_disponibili: p.disponibile,
    prezzo_al_pubblico: p.prezzo_pubblico_cent != null ? formattaEuro(p.prezzo_pubblico_cent) : null,
    miglior_prezzo_farmacia_iva_esclusa: p.prezzoMigliore ? formattaEuro(p.prezzoMigliore.farmaciaNettoCent) : null,
    lotti_disponibili: p.lotti.filter((l) => l.stato === "vendibile").length,
  };
}

// ---------------------------------------------------------------------------
// Esecuzione
// ---------------------------------------------------------------------------
export async function eseguiStrumento(nome: string, input: Record<string, unknown>, ctx: ContestoStrumenti & { catalogo: () => Promise<Catalogo> }): Promise<EsitoStrumento> {
  switch (nome) {
    case "cerca_prodotti": {
      const cercato = minuscolo(testo(input, "testo", 200));
      const parole = cercato.split(/\s+/).filter((p) => p.length > 1);
      const { prodotti } = await ctx.catalogo();
      const trovati = prodotti.filter((p) => {
        const dove = minuscolo([p.codice, p.nome, p.formato, p.linea?.nome, p.area?.nome, p.descrizione].filter(Boolean).join(" "));
        return parole.every((parola) => dove.includes(parola));
      });
      const elenco = trovati.slice(0, 25).map(descriviProdotto);
      return {
        riepilogo: trovati.length
          ? `Trovati ${trovati.length} prodotti${trovati.length > 25 ? " (mostrati i primi 25)" : ""}.`
          : "Nessun prodotto del catalogo corrisponde alla ricerca.",
        prodotti: elenco,
      };
    }

    case "dettaglio_prodotto": {
      const codice = testo(input, "codice", 50);
      const { prodotti } = await ctx.catalogo();
      const p = prodotti.find((x) => x.codice === codice) ?? prodotti.find((x) => minuscolo(x.nome) === minuscolo(codice));
      if (!p) return { riepilogo: `Il prodotto «${codice}» non è nel catalogo di questa farmacia.` };
      const vendibili = p.lotti.filter((l) => l.stato === "vendibile");
      return {
        riepilogo: `${p.nome}: ${ETICHETTE_STATO_PRODOTTO[p.stato].testo.toLowerCase()}, ${p.disponibile} pezzi disponibili in ${vendibili.length} lotti.`,
        prodotto: { ...descriviProdotto(p), descrizione: p.descrizione, minimo_ordine: p.minimo_ordine, multiplo: p.multiplo, iva_percentuale: p.iva },
        lotti: p.lotti.map(descriviLotto),
        link: `/farmacia/catalogo/${p.codice}`,
      };
    }

    case "promozioni_attive": {
      const catalogo = await ctx.catalogo();
      const perPromo = new Map<string, Set<string>>();
      for (const p of catalogo.prodotti) {
        for (const l of p.lotti.filter((x) => x.stato === "vendibile")) {
          const ids = [...(l.sconto?.origine === "promozione" && l.sconto.promozioneId ? [l.sconto.promozioneId] : []), ...l.promoMerce.map((m) => m.id)];
          for (const id of ids) perPromo.set(id, (perPromo.get(id) ?? new Set()).add(p.nome));
        }
      }
      if (!perPromo.size) return { riepilogo: "Oggi non ci sono promozioni attive per questa farmacia.", promozioni: [] };
      const { data, error } = await ctx.db.from("promozioni").select("*").in("id", [...perPromo.keys()]);
      if (error) throw new Error(error.message);
      const nomi = new Map(catalogo.prodotti.map((p) => [p.codice, p.nome]));
      const promozioni = ((data ?? []) as Promozione[]).map((p) => ({
        nome: p.nome,
        cosa_prevede: descriviPromozione(p, p.omaggio_prodotto_codice ? nomi.get(p.omaggio_prodotto_codice) : undefined),
        valida_fino_al: formattaData(p.fine),
        prodotti: [...perPromo.get(p.id)!].slice(0, 15),
      }));
      return { riepilogo: `${promozioni.length} promozioni attive.`, promozioni };
    }

    case "stato_ordini": {
      const numero = testo(input, "numero", 30).toUpperCase();
      let q = ctx.db
        .from("ordini")
        .select("id, numero, creato_il, stato, totale_cent, scade_il, consegna_indicativa_giorni, snapshot_societa, snapshot_pagamento")
        .eq("farmacia_id", ctx.farmaciaId)
        .order("creato_il", { ascending: false })
        .limit(10);
      if (numero) q = q.eq("numero", numero);
      const { data: ordini, error } = await q;
      if (error) throw new Error(error.message);
      if (!ordini?.length) return { riepilogo: numero ? `Nessun ordine ${numero} per questa farmacia.` : "Questa farmacia non ha ancora ordini." };
      const { data: sped } = await ctx.db.from("spedizioni").select("ordine_id, ddt_numero, ddt_data, corriere, tracking").in("ordine_id", ordini.map((o) => o.id));
      const spedizioni = new Map((sped ?? []).map((s) => [s.ordine_id, s]));
      return {
        riepilogo: numero ? `Ordine ${numero} trovato.` : `Ultimi ${ordini.length} ordini della farmacia.`,
        ordini: ordini.map((o) => {
          const stato = ETICHETTE_STATO_ORDINE[o.stato as StatoOrdine];
          const s = spedizioni.get(o.id);
          return {
            numero: o.numero,
            data: formattaData(o.creato_il),
            stato: stato.testo,
            spiegazione_stato: stato.spiegazione,
            totale_iva_inclusa: formattaEuro(o.totale_cent),
            societa_che_fattura: (o.snapshot_societa as { ragione_sociale: string }).ragione_sociale,
            pagamento: (o.snapshot_pagamento as { descrizione: string }).descrizione,
            conferma_entro: ["inviato", "in_verifica"].includes(o.stato) && o.scade_il ? formattaData(o.scade_il) : null,
            consegna_indicativa_giorni_lavorativi: o.consegna_indicativa_giorni,
            spedizione: s ? { ddt: `${s.ddt_numero} del ${formattaData(s.ddt_data)}`, corriere: s.corriere, tracking: s.tracking } : null,
            link: `/farmacia/ordini/${o.id}`,
          };
        }),
        nota: "Il riepilogo PDF/Excel e, dopo la spedizione, il DDT simulato si scaricano dalla pagina dell'ordine (link).",
      };
    }

    case "informazioni_vendita": {
      const [{ data: imp }, { data: consentite }, { data: societa }, { data: farmacia }, condizioni] = await Promise.all([
        ctx.db.from("impostazioni").select("giorni_validita_prenotazione, giorni_consegna_indicativi, soglia_minima_ordine_cent, soglia_trasporto_gratuito_cent, costo_trasporto_cent").single(),
        ctx.db.rpc("modalita_consentite_farmacia", { p_farmacia: ctx.farmaciaId }),
        ctx.db.from("societa").select("id, ragione_sociale, nome_breve, predefinita").eq("attiva", true).eq("attiva_farmacie", true),
        ctx.db.from("farmacie").select("societa_predefinita_id").eq("id", ctx.farmaciaId).single(),
        documentoCorrente("condizioni_farmacie"),
      ]);
      const ids = (consentite ?? []) as string[];
      const { data: pagamenti } = ids.length
        ? await ctx.db.from("modalita_pagamento").select("descrizione, costo_aggiuntivo_cent").in("id", ids).order("ordine")
        : { data: [] };
      const predefinita = (societa ?? []).find((s) => s.id === farmacia?.societa_predefinita_id) ?? (societa ?? []).find((s) => s.predefinita);
      return {
        riepilogo: "Condizioni di vendita per le farmacie lette dal portale.",
        ordine_minimo_iva_esclusa: imp?.soglia_minima_ordine_cent ? formattaEuro(imp.soglia_minima_ordine_cent) : "nessuno",
        validita_prenotazione: `La prenotazione non è vincolante finché Sagè Pharma non la conferma; se non viene confermata entro ${imp?.giorni_validita_prenotazione} giorni lavorativi scade e la merce torna disponibile.`,
        consegna_indicativa: `Circa ${imp?.giorni_consegna_indicativi} giorni lavorativi dalla conferma (indicativi, non garantiti).`,
        trasporto: imp?.costo_trasporto_cent
          ? `Costo ${formattaEuro(imp.costo_trasporto_cent)}${imp.soglia_trasporto_gratuito_cent ? `, gratuito sopra ${formattaEuro(imp.soglia_trasporto_gratuito_cent)} IVA esclusa` : ""}`
          : "Nessun costo di trasporto indicato nel portale.",
        modalita_di_pagamento: (pagamenti ?? []).map((p) => p.descrizione + (p.costo_aggiuntivo_cent ? ` (costo aggiuntivo ${formattaEuro(p.costo_aggiuntivo_cent)})` : "")),
        societa_che_possono_fatturare: (societa ?? []).map((s) => s.ragione_sociale),
        societa_predefinita_per_questa_farmacia: predefinita?.ragione_sociale ?? null,
        nota_societa: "La società che fattura si sceglie nel carrello al momento dell'invio.",
        condizioni_di_vendita: condizioni
          ? { versione: condizioni.versione, provvisorie: condizioni.provvisorio, testo: condizioni.testo.slice(0, 8000), link: "/condizioni/farmacie" }
          : null,
      };
    }

    case "cerca_informazioni": {
      const domanda = testo(input, "domanda", 500);
      if (!domanda) throw new InputNonValido("Indica cosa cercare");
      const risultati = await cercaKb(ctx.db, domanda, "farmacie");
      return {
        riepilogo: risultati.length
          ? `Trovati ${risultati.length} brani nella base di conoscenza approvata. Rispondi usando solo questi.`
          : "Nessuna informazione approvata su questo argomento. Non rispondere a memoria: dillo alla farmacia, registra la domanda e proponi l'operatore.",
        brani: risultati,
      };
    }

    case "proponi_aggiunta_carrello":
      return proponiAggiunta(input, ctx);

    case "passa_a_operatore": {
      const motivo = testo(input, "motivo", 500) || "Richiesta di assistenza";
      await ctx.passaAOperatore(motivo);
      ctx.effetti.operatore = true;
      return { riepilogo: "Richiesta inoltrata: un operatore riceve l'avviso e risponderà in questa chat (in orario d'ufficio). La farmacia può chiudere la pagina: riceverà anche un'email." };
    }

    case "registra_domanda_senza_risposta": {
      const domanda = testo(input, "domanda", 1000);
      if (!domanda) throw new InputNonValido("Indica la domanda");
      const { error } = await ctx.servizio.from("domande_senza_risposta").insert({ conversazione_id: ctx.conversazioneId, domanda });
      if (error) throw new Error(error.message);
      return { riepilogo: "Domanda registrata per il gruppo." };
    }

    default:
      throw new InputNonValido(`Strumento sconosciuto: ${nome}`);
  }
}

async function proponiAggiunta(input: Record<string, unknown>, ctx: ContestoStrumenti & { catalogo: () => Promise<Catalogo> }): Promise<EsitoStrumento> {
  const codice = testo(input, "codice_prodotto", 50);
  const quantita = intero(input, "quantita");
  const codiceLotto = testo(input, "codice_lotto", 60);
  const { prodotti } = await ctx.catalogo();
  const p = prodotti.find((x) => x.codice === codice);
  if (!p) return { riepilogo: `Il prodotto «${codice}» non è nel catalogo: nessuna proposta creata.` };

  const { data: carrello } = await ctx.db.from("carrello_righe").select("lotto_id, quantita").eq("farmacia_id", ctx.farmaciaId);
  const giaNelCarrello = new Map((carrello ?? []).map((r) => [r.lotto_id, r.quantita as number]));
  const libero = (l: LottoCatalogo) => l.disponibile - (giaNelCarrello.get(l.id) ?? 0);
  const vendibili = p.lotti.filter((l) => l.stato === "vendibile" && l.prezzi);

  let lotto: LottoCatalogo | undefined;
  if (codiceLotto) {
    lotto = p.lotti.find((l) => l.codice_lotto.toLowerCase() === codiceLotto.toLowerCase());
    if (!lotto || lotto.stato !== "vendibile" || !lotto.prezzi) return { riepilogo: `Il lotto «${codiceLotto}» di ${p.nome} non è disponibile: nessuna proposta creata.`, lotti_disponibili: vendibili.map(descriviLotto) };
  } else {
    lotto = vendibili.filter((l) => libero(l) >= quantita).sort((a, b) => a.prezzi!.farmaciaNettoCent - b.prezzi!.farmaciaNettoCent || (a.scadenza ?? "").localeCompare(b.scadenza ?? ""))[0];
    if (!lotto) {
      return {
        riepilogo: `Nessun lotto di ${p.nome} ha ${quantita} pezzi liberi: nessuna proposta creata. Proponi una quantità minore o più lotti.`,
        lotti_disponibili: vendibili.map((l) => ({ ...descriviLotto(l), pezzi_liberi_considerando_il_carrello: libero(l) })),
      };
    }
  }
  if (quantita > libero(lotto)) {
    return { riepilogo: `Del lotto ${lotto.codice_lotto} si possono aggiungere al massimo ${Math.max(libero(lotto), 0)} pezzi (considerando il carrello): nessuna proposta creata.` };
  }

  const { data: proposta, error } = await ctx.servizio
    .from("proposte_carrello")
    .insert({
      conversazione_id: ctx.conversazioneId,
      farmacia_id: ctx.farmaciaId,
      lotto_id: lotto.id,
      prodotto_codice: p.codice,
      prodotto_nome: p.nome,
      codice_lotto: lotto.codice_lotto,
      scadenza: lotto.scadenza,
      quantita,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  ctx.effetti.proposte.push(proposta.id);

  const avvisi: string[] = [];
  const totaleProdotto = quantita + [...giaNelCarrello].filter(([id]) => p.lotti.some((l) => l.id === id)).reduce((s, [, q]) => s + q, 0);
  if (totaleProdotto < p.minimo_ordine) avvisi.push(`L'ordine minimo per questo prodotto è di ${p.minimo_ordine} pezzi.`);
  if (totaleProdotto % p.multiplo !== 0) avvisi.push(`La quantità totale del prodotto deve essere multipla di ${p.multiplo}.`);

  return {
    riepilogo: `Proposta pronta, NON ancora nel carrello: ${quantita} pezzi di ${p.nome}, lotto ${lotto.codice_lotto}. La farmacia deve premere «Conferma» nel riquadro sotto il tuo messaggio.`,
    lotto: descriviLotto(lotto),
    totale_riga_iva_esclusa: formattaEuro(lotto.prezzi!.farmaciaNettoCent * quantita),
    avvisi,
  };
}

/** Catalogo caricato una sola volta per turno di conversazione. */
export function catalogoPigro(db: SupabaseClient, farmaciaId: string): () => Promise<Catalogo> {
  let promessa: Promise<Catalogo> | null = null;
  return () => (promessa ??= caricaCatalogo(db, { farmaciaId }));
}
