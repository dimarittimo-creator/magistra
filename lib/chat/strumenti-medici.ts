import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { cercaKb } from "@/lib/chat/kb";
import { InputNonValido, eseguiStrumento, type ContestoStrumenti, type EsitoStrumento } from "@/lib/chat/strumenti";
import { leggiSchede } from "@/lib/medici/contenuti";

// Strumenti dell'assistente per i medici (docs/AREA_MEDICI.md §2): solo informazioni approvate sui prodotti,
// nessun dato commerciale (prezzi, lotti, disponibilità, ordini) e nessuna proposta di carrello.

function definizione(name: string, description: string, proprieta: Record<string, { type: "string"; description: string }>): Anthropic.Beta.BetaTool {
  return {
    name,
    description,
    input_schema: { type: "object", properties: proprieta, required: Object.keys(proprieta), additionalProperties: false },
    eager_input_streaming: true,
  };
}

export const STRUMENTI_MEDICI: Anthropic.Beta.BetaTool[] = [
  definizione(
    "cerca_schede_prodotto",
    "Cerca tra i prodotti di Sagè Pharma e Bioeleva presentati nell'area Medici, per nome, linea o area terapeutica. Restituisce nome, formato, linea, area, descrizione e il link alla scheda. Se un prodotto non compare qui, per il portale non esiste. Testo vuoto = elenco completo.",
    { testo: { type: "string", description: "Parole da cercare (es. 'magnesio', 'ginecologia'); stringa vuota per tutti i prodotti" } },
  ),
  definizione(
    "cerca_informazioni",
    "Cerca nella base di conoscenza approvata da Sagè Pharma e Bioeleva per i medici (composizione, formato, modo d'uso, avvertenze, studi e materiale informativo). È l'UNICA fonte ammessa per le informazioni sui prodotti.",
    { domanda: { type: "string", description: "La domanda o le parole chiave da cercare" } },
  ),
  definizione(
    "passa_a_operatore",
    "Passa la conversazione a un operatore di Sagè Pharma, che riceve un avviso e risponde in questa stessa chat. Usalo quando il medico lo chiede, o quando non trovi la risposta e il medico vuole essere aiutato da una persona.",
    { motivo: { type: "string", description: "Riassunto breve di cosa serve al medico" } },
  ),
  definizione(
    "registra_domanda_senza_risposta",
    "Registra una domanda a cui non sai rispondere con la base di conoscenza, così il gruppo può aggiungere l'informazione mancante.",
    { domanda: { type: "string", description: "La domanda del medico, riformulata in modo chiaro" } },
  ),
];

const minuscolo = (s: string) => s.toLocaleLowerCase("it-IT").normalize("NFD").replace(/[̀-ͯ]/g, "");

export type ContestoStrumentiMedici = Omit<ContestoStrumenti, "farmaciaId">;

export async function eseguiStrumentoMedici(nome: string, input: Record<string, unknown>, ctx: ContestoStrumentiMedici): Promise<EsitoStrumento> {
  switch (nome) {
    case "cerca_schede_prodotto": {
      const v = input.testo;
      if (typeof v !== "string") throw new InputNonValido("Il parametro «testo» deve essere un testo");
      const parole = minuscolo(v.trim().slice(0, 200)).split(/\s+/).filter((p) => p.length > 1);
      const trovati = (await leggiSchede()).filter((p) => {
        const dove = minuscolo([p.codice, p.nome, p.formato, p.linea, p.area, p.descrizione].filter(Boolean).join(" "));
        return parole.every((parola) => dove.includes(parola));
      });
      return {
        riepilogo: trovati.length
          ? `Trovati ${trovati.length} prodotti${trovati.length > 25 ? " (mostrati i primi 25)" : ""}.`
          : "Nessun prodotto corrisponde alla ricerca.",
        prodotti: trovati.slice(0, 25).map((p) => ({ ...p, link: `/medici/prodotti/${p.codice}` })),
      };
    }
    case "cerca_informazioni": {
      const v = input.domanda;
      if (typeof v !== "string" || !v.trim()) throw new InputNonValido("Indica cosa cercare");
      const risultati = await cercaKb(ctx.servizio, v.trim().slice(0, 500), "medici");
      return {
        riepilogo: risultati.length
          ? `Trovati ${risultati.length} brani nella base di conoscenza approvata. Rispondi usando solo questi.`
          : "Nessuna informazione approvata su questo argomento. Non rispondere a memoria: dillo al medico, registra la domanda e proponi l'operatore.",
        brani: risultati,
      };
    }
    case "passa_a_operatore":
    case "registra_domanda_senza_risposta":
      // Stesso comportamento dell'assistente per le farmacie (nessun dato commerciale coinvolto)
      return eseguiStrumento(nome, input, { ...ctx, farmaciaId: "", catalogo: () => Promise.reject(new Error("Catalogo non disponibile")) });
    default:
      throw new InputNonValido(`Strumento sconosciuto: ${nome}`);
  }
}
