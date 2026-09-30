import { describe, expect, it } from "vitest";
import { dividiInFrammenti, normalizzaTesto } from "@/lib/chat/frammenti";
import { modalitaAssistente } from "@/lib/chat/modalita";
import { rispostaDiProva } from "@/lib/chat/modello-prova";

// Fase 6 – assistente: base di conoscenza, scelta del modello, modalità di prova.

describe("frammenti della base di conoscenza", () => {
  it("pulisce il testo incollato", () => {
    expect(normalizzaTesto("  Riga uno  \r\n\r\n\r\n\r\nRiga\t\tdue  ")).toBe("Riga uno\n\nRiga due");
  });

  it("unisce i paragrafi brevi e ripete il titolo in ogni frammento", () => {
    const f = dividiInFrammenti("Magnesio 300", "Formato: 30 compresse.\n\nModo d'uso: una al giorno.");
    expect(f).toEqual(["Magnesio 300\nFormato: 30 compresse.\n\nModo d'uso: una al giorno."]);
  });

  it("divide i testi lunghi senza superare la lunghezza massima e senza perdere parole", () => {
    const paragrafi = Array.from({ length: 12 }, (_, i) => `Paragrafo ${i}. ${"Frase di prova con informazioni. ".repeat(12)}`);
    const f = dividiInFrammenti("Scheda", paragrafi.join("\n\n"));
    expect(f.length).toBeGreaterThan(3);
    for (const x of f) {
      expect(x.startsWith("Scheda\n")).toBe(true);
      expect(x.length).toBeLessThanOrEqual(1200 + "Scheda\n".length);
    }
    const parole = (s: string) => s.replace(/Scheda\n/g, "").split(/\s+/).filter(Boolean).length;
    expect(f.reduce((s, x) => s + parole(x), 0)).toBe(parole(paragrafi.join(" ")));
  });

  it("spezza anche un paragrafo lunghissimo senza punteggiatura", () => {
    const f = dividiInFrammenti("T", "a".repeat(3000));
    expect(f).toHaveLength(3);
  });
});

describe("scelta dell'assistente", () => {
  it("usa Claude se c'è la chiave", () => {
    expect(modalitaAssistente({}, { NODE_ENV: "production", ANTHROPIC_API_KEY: "x" })).toBe("ai");
  });
  it("senza chiave: prova in locale, solo operatore online", () => {
    expect(modalitaAssistente({}, { NODE_ENV: "development" })).toBe("prova");
    expect(modalitaAssistente({}, { NODE_ENV: "production" })).toBe("solo_operatore");
  });
  it("la modalità di prova richiesta dai test non vale mai in produzione", () => {
    expect(modalitaAssistente({ provaRichiesta: true }, { NODE_ENV: "development", ANTHROPIC_API_KEY: "x" })).toBe("prova");
    expect(modalitaAssistente({ provaRichiesta: true }, { NODE_ENV: "production", ANTHROPIC_API_KEY: "x" })).toBe("ai");
  });
  it("si può spegnere del tutto", () => {
    expect(modalitaAssistente({}, { NODE_ENV: "production", ANTHROPIC_API_KEY: "x", ASSISTENTE_MODALITA: "spento" })).toBe("solo_operatore");
  });
});

describe("modalità di prova", () => {
  const domanda = (text: string) => rispostaDiProva({ system: [], tools: [], messages: [{ role: "user", content: [{ type: "text", text }] }] });
  const strumento = async (text: string) => {
    const r = await domanda(text);
    const uso = r.content.find((b) => b.type === "tool_use");
    return uso?.type === "tool_use" ? { nome: uso.name, input: uso.input } : null;
  };

  it("chiama gli strumenti giusti", async () => {
    expect(await strumento("Aggiungi 10 pezzi del prodotto 000123456 lotto AB12")).toEqual({
      nome: "proponi_aggiunta_carrello",
      input: { codice_prodotto: "000123456", quantita: 10, codice_lotto: "AB12" },
    });
    expect(await strumento("A che punto è l'ordine P-2026-00052?")).toEqual({ nome: "stato_ordini", input: { numero: "P-2026-00052" } });
    expect((await strumento("Quali promozioni avete?"))?.nome).toBe("promozioni_attive");
    expect((await strumento("Voglio un operatore"))?.nome).toBe("passa_a_operatore");
    expect((await strumento("Come posso pagare?"))?.nome).toBe("informazioni_vendita");
    expect(await strumento("Lotti del 000123456")).toEqual({ nome: "dettaglio_prodotto", input: { codice: "000123456" } });
    expect((await strumento("Qual è la composizione?"))?.nome).toBe("cerca_informazioni");
  });

  it("non dà indicazioni sul singolo paziente", async () => {
    const r = await domanda("Posso darlo a mio figlio di 3 anni?");
    expect(r.stop_reason).toBe("end_turn");
    expect(JSON.stringify(r.content)).toContain("parere del medico");
  });

  it("se la base di conoscenza non ha la risposta, registra la domanda invece di inventare", async () => {
    const r = await rispostaDiProva({
      system: [],
      tools: [],
      messages: [
        { role: "user", content: [{ type: "text", text: "Qual è la composizione?" }] },
        { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "cerca_informazioni", input: { domanda: "Qual è la composizione?" } }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: JSON.stringify({ riepilogo: "Nessuna informazione", brani: [] }) }] },
      ],
    });
    const uso = r.content.find((b) => b.type === "tool_use");
    expect(uso?.type === "tool_use" && uso.name).toBe("registra_domanda_senza_risposta");
  });
});
