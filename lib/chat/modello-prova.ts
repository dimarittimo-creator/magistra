import type Anthropic from "@anthropic-ai/sdk";
import type { RichiestaModello, RispostaModello } from "@/lib/chat/modello";

// "Modalità di prova" dell'assistente: NON è intelligenza artificiale.
// Riconosce poche parole chiave, chiama gli stessi strumenti del modello vero e riassume i risultati.
// Serve per provare in locale e nei test automatici tutto il percorso (strumenti, proposte di carrello,
// operatore, domande senza risposta) senza chiave e senza costi. Mai usata in produzione.

type Blocco = Anthropic.Beta.BetaContentBlock;
type Parametro = Anthropic.Beta.BetaContentBlockParam;

let contatore = 0;

function testoBlocco(testo: string): Blocco {
  return { type: "text", text: testo, citations: null } as Blocco;
}

function usaStrumento(name: string, input: Record<string, unknown>): RispostaModello {
  contatore += 1;
  return {
    content: [{ type: "tool_use", id: `toolu_prova_${Date.now()}_${contatore}`, name, input } as Blocco],
    stop_reason: "tool_use",
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}

function rispondi(testo: string): RispostaModello {
  return { content: [testoBlocco(testo)], stop_reason: "end_turn", usage: { input_tokens: 0, output_tokens: 0 } };
}

function blocchi(m: Anthropic.Beta.BetaMessageParam): Parametro[] {
  return typeof m.content === "string" ? [{ type: "text", text: m.content }] : (m.content as Parametro[]);
}

type Esito = { riepilogo?: string; [k: string]: unknown };

function elenco(righe: string[]): string {
  return righe.map((r) => `- ${r}`).join("\n");
}

/** Riassunto leggibile di un risultato di strumento. */
function descrivi(nome: string, esito: Esito): string {
  const parti = [esito.riepilogo ?? ""];
  const lista = <T>(chiave: string) => (Array.isArray(esito[chiave]) ? (esito[chiave] as T[]) : []);
  if (nome === "cerca_prodotti") {
    parti.push(elenco(lista<Record<string, string>>("prodotti").map((p) => `${p.nome} (codice ${p.codice}): ${p.stato}, ${p.pezzi_disponibili} pezzi${p.miglior_prezzo_farmacia_iva_esclusa ? `, da ${p.miglior_prezzo_farmacia_iva_esclusa} IVA esclusa` : ""}`)));
  }
  if (nome === "dettaglio_prodotto" || nome === "proponi_aggiunta_carrello") {
    parti.push(elenco(lista<Record<string, string>>("lotti").map((l) => `Lotto ${l.codice_lotto}, scadenza ${l.scadenza}: ${l.pezzi_disponibili} pezzi, sconto ${l.sconto_percentuale ?? 0}%, ${l.prezzo_farmacia_iva_esclusa} IVA esclusa`)));
    const lotto = esito.lotto as Record<string, string> | undefined;
    if (lotto) parti.push(`Lotto ${lotto.codice_lotto}, scadenza ${lotto.scadenza}, ${lotto.prezzo_farmacia_iva_esclusa} a pezzo IVA esclusa (totale ${esito.totale_riga_iva_esclusa}).`);
    parti.push(...lista<string>("avvisi"));
  }
  if (nome === "promozioni_attive") {
    parti.push(elenco(lista<Record<string, string>>("promozioni").map((p) => `${p.nome}: ${p.cosa_prevede}, fino al ${p.valida_fino_al}`)));
  }
  if (nome === "stato_ordini") {
    parti.push(elenco(lista<Record<string, string>>("ordini").map((o) => `${o.numero} del ${o.data}: ${o.stato} (${o.spiegazione_stato}), totale ${o.totale_iva_inclusa}`)));
  }
  if (nome === "informazioni_vendita") {
    parti.push(`Ordine minimo: ${esito.ordine_minimo_iva_esclusa}.`, String(esito.validita_prenotazione), String(esito.consegna_indicativa));
    parti.push(`Pagamenti: ${lista<string>("modalita_di_pagamento").join(", ") || "nessuno"}.`);
    parti.push(`Società che fatturano: ${lista<string>("societa_che_possono_fatturare").join(", ")}.`);
  }
  if (nome === "cerca_informazioni") {
    const [primo] = lista<Record<string, string>>("brani");
    if (primo) parti.push(primo.testo);
  }
  return parti.filter(Boolean).join("\n");
}

export async function rispostaDiProva(r: RichiestaModello): Promise<RispostaModello> {
  const ultimo = r.messages.at(-1)!;
  const contenuto = blocchi(ultimo);
  const risultati = contenuto.filter((b): b is Anthropic.Beta.BetaToolResultBlockParam => b.type === "tool_result");

  // Dopo gli strumenti: riassunto dei risultati
  if (risultati.length) {
    const precedente = r.messages.at(-2)!;
    const usi = blocchi(precedente).filter((b): b is Anthropic.Beta.BetaToolUseBlockParam => b.type === "tool_use");
    const testi: string[] = [];
    for (const res of risultati) {
      const uso = usi.find((u) => u.id === res.tool_use_id);
      const grezzo = typeof res.content === "string" ? res.content : (res.content ?? []).map((c) => ("text" in c ? c.text : "")).join("");
      if (res.is_error) {
        testi.push("Non sono riuscito a completare la verifica. Riprovi o scriva «operatore».");
        continue;
      }
      const esito = JSON.parse(grezzo) as Esito;
      if (uso?.name === "cerca_informazioni" && Array.isArray(esito.brani) && esito.brani.length === 0) {
        return usaStrumento("registra_domanda_senza_risposta", { domanda: String((uso.input as { domanda: string }).domanda) });
      }
      if (uso?.name === "registra_domanda_senza_risposta") {
        testi.push("Non ho informazioni approvate su questo argomento, quindi preferisco non rispondere a memoria. Ho registrato la domanda per il nostro staff. Se vuole, scriva «operatore» e una persona le risponderà qui.");
        continue;
      }
      if (uso?.name === "proponi_aggiunta_carrello" && !/NON ancora nel carrello/.test(esito.riepilogo ?? "")) {
        testi.push(descrivi(uso.name, esito));
        continue;
      }
      if (uso?.name === "proponi_aggiunta_carrello") {
        testi.push(`${descrivi(uso.name, esito)}\nPer metterlo nel carrello prema «Conferma» qui sotto.`);
        continue;
      }
      testi.push(descrivi(uso?.name ?? "", esito));
    }
    return rispondi(testi.join("\n\n"));
  }

  // Nuova domanda: parole chiave
  const domanda = contenuto.filter((b): b is Anthropic.Beta.BetaTextBlockParam => b.type === "text").at(-1)?.text ?? "";
  const t = domanda.toLowerCase();
  const codice = domanda.match(/\b\d{5,}\b/)?.[0];
  const numeroOrdine = domanda.toUpperCase().match(/\bP-\d{4}-\d{5}\b/)?.[0];

  if (/operatore|persona|umano/.test(t)) return usaStrumento("passa_a_operatore", { motivo: domanda.slice(0, 300) });
  if (/pazient|bambin|gravidanz|incinta|mio figlio|mia figlia|posso dar/.test(t)) {
    return rispondi("Per il singolo paziente non posso dare indicazioni: serve il parere del medico. Posso però aiutarla con disponibilità, lotti, promozioni e ordini.");
  }
  const aggiungi = t.match(/\b(aggiungi|metti|ordina)\b\D*?(\d{1,4})\b/);
  if (aggiungi && codice) {
    const lotto = domanda.match(/lotto\s+([A-Za-z0-9./-]+)/i)?.[1] ?? "";
    return usaStrumento("proponi_aggiunta_carrello", { codice_prodotto: codice, quantita: Number(aggiungi[2]), codice_lotto: lotto });
  }
  if (numeroOrdine || /\bordin/.test(t)) return usaStrumento("stato_ordini", { numero: numeroOrdine ?? "" });
  if (/promo/.test(t)) return usaStrumento("promozioni_attive", {});
  if (/pagament|pagar|consegn|fattur|condizion|minimo/.test(t)) return usaStrumento("informazioni_vendita", {});
  if (codice) return usaStrumento("dettaglio_prodotto", { codice });
  const cerca = t.match(/(?:cerca|disponibilit[aà] d[ie]l?|avete)\s+(.+)/)?.[1];
  if (cerca) return usaStrumento("cerca_prodotti", { testo: cerca.replace(/[?!.]/g, "").trim() });
  return usaStrumento("cerca_informazioni", { domanda });
}
