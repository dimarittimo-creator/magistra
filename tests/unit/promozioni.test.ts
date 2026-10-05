import { describe, expect, it } from "vitest";
import { scontoPerLotto, type Fascia } from "@/lib/pricing";
import { calcolaOmaggiExtra, descriviOmaggioExtra, descriviPromozione, migliorScontoPromo, pezziOmaggio, promoExtra, promozioneSiApplica, statoPromozione, type Promozione } from "@/lib/promozioni";

const OGGI = "2026-10-15";
const fasce: Fascia[] = [
  { mesi_minimi: 8, sconto_percentuale: 38 },
  { mesi_minimi: 6, sconto_percentuale: 40 },
  { mesi_minimi: 0, sconto_percentuale: 45 },
];
const base: Promozione = {
  id: "p1", nome: "Autunno", tipo: "sconto_percentuale", sconto_percentuale: 42, compra: null, omaggio_quantita: null, omaggio_prodotto_codice: null,
  ambito: "prodotto", prodotto_codice: "111111111", lotto_id: null, linea_id: null, gruppo_id: null, inizio: "2026-10-01", fine: "2026-10-31", sospesa: false,
};
const cosa = { prodotto: "111111111", lineaId: "linea-a", lottoId: "lotto-1" };

describe("Promozioni", () => {
  it("attive solo tra inizio e fine e se non sospese", () => {
    expect(statoPromozione(base, OGGI)).toBe("attiva");
    expect(statoPromozione(base, "2026-09-30")).toBe("programmata");
    expect(statoPromozione(base, "2026-11-01")).toBe("conclusa");
    expect(statoPromozione({ ...base, sospesa: true }, OGGI)).toBe("sospesa");
  });

  it("ambito prodotto, linea, lotto, catalogo e gruppo di farmacie", () => {
    expect(promozioneSiApplica(base, cosa, { gruppoId: null }, OGGI)).toBe(true);
    expect(promozioneSiApplica(base, { ...cosa, prodotto: "222222222" }, { gruppoId: null }, OGGI)).toBe(false);
    expect(promozioneSiApplica({ ...base, ambito: "linea", linea_id: "linea-a" }, cosa, { gruppoId: null }, OGGI)).toBe(true);
    expect(promozioneSiApplica({ ...base, ambito: "lotto", lotto_id: "lotto-2" }, cosa, { gruppoId: null }, OGGI)).toBe(false);
    expect(promozioneSiApplica({ ...base, ambito: "catalogo" }, cosa, { gruppoId: null }, OGGI)).toBe(true);
    expect(promozioneSiApplica({ ...base, gruppo_id: "storici" }, cosa, { gruppoId: null }, OGGI)).toBe(false);
    expect(promozioneSiApplica({ ...base, gruppo_id: "storici" }, cosa, { gruppoId: "storici" }, OGGI)).toBe(true);
  });

  it("vale il migliore tra sconto del lotto, listino di gruppo e promozione, mai la somma", () => {
    const promo = migliorScontoPromo([base, { ...base, id: "p2", sconto_percentuale: 39 }], cosa, { gruppoId: null }, OGGI);
    expect(promo).toEqual({ id: "p1", sconto: 42 });
    // Lotto a lunga scadenza (fascia 38%): vince la promozione al 42%
    expect(scontoPerLotto({ scadenza: "2028-01-01", oggi: OGGI, fasce, promozione: promo })).toMatchObject({ sconto: 42, origine: "promozione", promozioneId: "p1" });
    // Lotto a breve scadenza (fascia 45%): resta la fascia
    expect(scontoPerLotto({ scadenza: "2027-01-01", oggi: OGGI, fasce, promozione: promo })).toMatchObject({ sconto: 45, origine: "fascia" });
    // Sconto del listino di gruppo più alto di tutti
    expect(scontoPerLotto({ scadenza: "2028-01-01", oggi: OGGI, fasce, promozione: promo, scontoGruppo: 50 })).toMatchObject({ sconto: 50, origine: "listino_gruppo" });
  });

  it("sconto merce 10+2: omaggi per ogni blocco completo", () => {
    const merce = { compra: 10, omaggio_quantita: 2 };
    expect(pezziOmaggio(merce, 9)).toBe(0);
    expect(pezziOmaggio(merce, 10)).toBe(2);
    expect(pezziOmaggio(merce, 25)).toBe(4);
    expect(descriviPromozione({ tipo: "sconto_merce", ...merce })).toBe("10+2: ogni 10 pezzi, 2 in omaggio");
  });
});

describe("omaggi extra non a magazzino (es. espositore)", () => {
  const espositore = { id: "p1", nome: "Primus Task ottobre", testo: "espositore da banco Primus Task", ogni: 24, quantita: 1 };

  it("1 ogni 24 pezzi, sommando lotti diversi", () => {
    expect(calcolaOmaggiExtra([{ quantita: 10, promoExtra: [espositore] }, { quantita: 14, promoExtra: [espositore] }])).toEqual([
      { promozione_id: "p1", nome: "Primus Task ottobre", testo: "espositore da banco Primus Task", quantita: 1 },
    ]);
    expect(calcolaOmaggiExtra([{ quantita: 50, promoExtra: [espositore] }])[0].quantita).toBe(2);
  });

  it("sotto la soglia non spetta nulla; le righe senza promozione non contano", () => {
    expect(calcolaOmaggiExtra([{ quantita: 23, promoExtra: [espositore] }, { quantita: 100, promoExtra: [] }])).toEqual([]);
  });

  it("si ricava dalla promozione solo se i tre campi ci sono, e si descrive in italiano", () => {
    const promo = { id: "p1", nome: "X", tipo: "sconto_percentuale", sconto_percentuale: 42, compra: null, omaggio_quantita: null, omaggio_prodotto_codice: null, ambito: "prodotto", prodotto_codice: "1", lotto_id: null, linea_id: null, gruppo_id: null, inizio: "2026-10-05", fine: "2026-10-15", sospesa: false } as const;
    expect(promoExtra({ ...promo })).toBeNull();
    expect(promoExtra({ ...promo, omaggio_extra_testo: "espositore", omaggio_extra_ogni: 24, omaggio_extra_quantita: 1 })).toEqual({ id: "p1", nome: "X", testo: "espositore", ogni: 24, quantita: 1 });
    expect(descriviOmaggioExtra(espositore)).toBe("1 espositore da banco Primus Task in omaggio ogni 24 pezzi");
  });
});
