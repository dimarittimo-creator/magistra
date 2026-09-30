import { describe, expect, it } from "vitest";
import { assegnaLottiPrivato, disponibilePrivati } from "@/lib/availability";
import { calcolaTotaliPrivati, prezzoPrivato, speseSpedizione } from "@/lib/pricing";
import { migliorScontoPrivati, periodoMeseSuccessivo, servePromemoria, type ScontoPrivati } from "@/lib/sconti-privati";

const sconto = (s: Partial<ScontoPrivati>): ScontoPrivati => ({
  id: "s", ambito: "catalogo", linea_id: null, prodotto_codice: null, sconto_percentuale: 10, inizio: "2026-10-01", fine: "2026-10-31", ...s,
});

describe("Sconti privati del mese", () => {
  const p = { codice: "111111111", lineaId: "linea-a" };
  it("vale il migliore tra globale, linea e prodotto, mai la somma", () => {
    const tutti = [sconto({ id: "g", sconto_percentuale: 10 }), sconto({ id: "l", ambito: "linea", linea_id: "linea-a", sconto_percentuale: 15 }), sconto({ id: "p", ambito: "prodotto", prodotto_codice: "111111111", sconto_percentuale: 12 })];
    expect(migliorScontoPrivati(tutti, p, "2026-10-15")?.id).toBe("l");
    expect(migliorScontoPrivati(tutti, { codice: "222222222", lineaId: null }, "2026-10-15")?.id).toBe("g");
  });
  it("a cambio mese lo sconto scade da solo", () => {
    const s = [sconto({})];
    expect(migliorScontoPrivati(s, p, "2026-10-31")).not.toBeNull();
    expect(migliorScontoPrivati(s, p, "2026-11-01")).toBeNull();
  });
  it("copia sul mese successivo: mese intero → mese intero (anche febbraio)", () => {
    expect(periodoMeseSuccessivo({ inizio: "2026-10-01", fine: "2026-10-31" })).toEqual({ inizio: "2026-11-01", fine: "2026-11-30" });
    expect(periodoMeseSuccessivo({ inizio: "2027-01-01", fine: "2027-01-31" })).toEqual({ inizio: "2027-02-01", fine: "2027-02-28" });
    expect(periodoMeseSuccessivo({ inizio: "2026-10-10", fine: "2026-10-20" })).toEqual({ inizio: "2026-11-10", fine: "2026-11-20" });
  });
  it("promemoria 5 giorni prima della fine del mese se il mese dopo è scoperto", () => {
    expect(servePromemoria([sconto({})], "2026-10-26")).toBe(true);
    expect(servePromemoria([sconto({}), sconto({ inizio: "2026-11-01", fine: "2026-11-30" })], "2026-10-26")).toBe(false);
    expect(servePromemoria([sconto({})], "2026-10-25")).toBe(false);
  });
});

describe("Prezzi e totali privati", () => {
  it("prezzo con sconto del mese: 65,00 € − 20% = 52,00 € IVA inclusa", () => {
    expect(prezzoPrivato(6500, 10, 20)).toEqual({ pienoCent: 6500, scontoPercentuale: 20, ivatoCent: 5200, nettoCent: 4727 });
    expect(prezzoPrivato(6500, 10, null).ivatoCent).toBe(6500);
  });
  it("il totale è la somma dei prezzi mostrati più la spedizione; IVA per scorporo", () => {
    const t = calcolaTotaliPrivati(
      [
        { quantita: 3, ivaPercentuale: 10, prezzo: prezzoPrivato(2250, 10, 15) },
        { quantita: 1, ivaPercentuale: 22, prezzo: prezzoPrivato(1990, 22, null) },
      ],
      { ivatoCent: 690, ivaPercentuale: 22 },
    );
    expect(t.prodottiCent).toBe(1913 * 3 + 1990);
    expect(t.totaleCent).toBe(1913 * 3 + 1990 + 690);
    expect(t.imponibileCent + t.ivaCent).toBe(t.totaleCent);
    expect(t.ivaDettaglio.map((d) => d.aliquota)).toEqual([10, 22]);
  });
  it("spedizione gratuita oltre la soglia; senza valori impostati non si calcola", () => {
    expect(speseSpedizione(4000, { importo_cent: 690, soglia_gratuita_cent: 5000 })).toBe(690);
    expect(speseSpedizione(5000, { importo_cent: 690, soglia_gratuita_cent: 5000 })).toBe(0);
    expect(speseSpedizione(5000, { importo_cent: null, soglia_gratuita_cent: null })).toBeNull();
  });
});

describe("Assegnazione del lotto ai privati", () => {
  const lotti = [
    { id: "breve", scadenza: "2027-01-31", disponibile: 100, stato: "vendibile" as const },
    { id: "a", scadenza: "2027-06-30", disponibile: 5, stato: "vendibile" as const },
    { id: "b", scadenza: "2028-01-31", disponibile: 50, stato: "vendibile" as const },
  ];
  const opz = { oggi: "2026-10-15", mesiMinimi: 6 };
  it("scadenza più vicina tra i lotti con almeno 6 mesi; i lotti più corti restano alle farmacie", () => {
    expect(assegnaLottiPrivato(lotti, 3, opz)?.map((x) => [x.lotto.id, x.quantita])).toEqual([["a", 3]]);
    expect(disponibilePrivati(lotti, opz)).toBe(55);
  });
  it("se un lotto non basta si prosegue col successivo; oltre il disponibile nessuna assegnazione", () => {
    expect(assegnaLottiPrivato(lotti, 8, opz)?.map((x) => [x.lotto.id, x.quantita])).toEqual([["a", 5], ["b", 3]]);
    expect(assegnaLottiPrivato(lotti, 56, opz)).toBeNull();
  });
});
