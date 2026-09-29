import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { statoLotto, type StatoLotto } from "@/lib/availability";
import { aggiungiGiorniLavorativi, aggiungiMesi } from "@/lib/date";
import { leggiScadenza } from "@/lib/import/giacenza";
import { calcolaPrezzi, calcolaTotali, fasciaPerScadenza, scontoPerLotto, type Fascia } from "@/lib/pricing";

// Dati attesi: dati/verifica_prezzi_attesi.xlsx, calcolati alla data del 28/09/2026.
const wb = XLSX.read(readFileSync("dati/verifica_prezzi_attesi.xlsx"), { type: "buffer" });
const parametri = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Parametri, { header: 1, raw: true, defval: null });
const fasce: Fascia[] = parametri
  .filter((r) => typeof r[0] === "string" && r[0].startsWith("Fascia ") && typeof r[1] === "number")
  .map((r) => ({ mesi_minimi: r[1] as number, sconto_percentuale: Math.round((r[2] as number) * 10000) / 100 }));
const OGGI = "2026-09-28";
const righe = XLSX.utils
  .sheet_to_json<unknown[]>(wb.Sheets["Anteprima prezzi"], { header: 1, raw: true, defval: null })
  .slice(1)
  .filter((r) => typeof r[0] === "string" && typeof r[6] === "string");

const STATI_FILE: Partial<Record<StatoLotto, string>> = {
  vendibile: "Disponibile",
  difformita: "Mancante temporaneamente (difformità)",
  mancante: "Mancante (senza scadenza)",
  prezzo_mancante: "Prezzo mancante",
};
const cent = (euro: number) => Math.round(euro * 100);

describe("Prezzi e stati come nel file di verifica (28/09/2026)", () => {
  it("il file contiene le fasce 8/38%, 6/40%, 0/45% e 64 lotti", () => {
    expect(fasce).toEqual([
      { mesi_minimi: 8, sconto_percentuale: 38 },
      { mesi_minimi: 6, sconto_percentuale: 40 },
      { mesi_minimi: 0, sconto_percentuale: 45 },
    ]);
    expect(righe.length).toBe(64);
  });

  it.each(righe.map((r) => [`${r[1]} lotto ${r[2]}`, r] as const))("%s", (_nome, r) => {
    const scadenza = leggiScadenza(r[3]);
    const stato = statoLotto(
      { deposito_id: "d", scadenza, giacenza: r[4] as number, disponibile: r[4] as number },
      { oggi: OGGI, difforme: r[14] !== r[15], conPrezzo: typeof r[7] === "number" },
    );
    expect(STATI_FILE[stato]).toBe(r[6]);
    if (stato !== "vendibile") return;

    const sconto = scontoPerLotto({ scadenza: scadenza!, oggi: OGGI, fasce })!;
    expect(sconto.sconto).toBeCloseTo((r[10] as number) * 100, 6);
    const prezzi = calcolaPrezzi(cent(r[7] as number), (r[8] as number) * 100, sconto.sconto);
    expect(prezzi.pubblicoNettoCent).toBe(cent(r[9] as number));
    expect(prezzi.farmaciaIvatoCent).toBe(cent(r[11] as number));
    expect(prezzi.farmaciaNettoCent).toBe(cent(r[12] as number));
  });
});

describe("Regole di calcolo", () => {
  it("esempio della documentazione: Lactorepens 65,00 € con 38% → 40,30 € → 36,64 € IVA esclusa", () => {
    expect(calcolaPrezzi(6500, 10, 38)).toEqual({
      pubblicoIvatoCent: 6500,
      pubblicoNettoCent: 5909,
      farmaciaIvatoCent: 4030,
      farmaciaNettoCent: 3664,
    });
  });

  it("oggi + N mesi come EDATE di Excel (fine mese)", () => {
    expect(aggiungiMesi("2026-01-31", 1)).toBe("2026-02-28");
    expect(aggiungiMesi("2026-09-28", 8)).toBe("2027-05-28");
    expect(aggiungiMesi("2026-08-31", 6)).toBe("2027-02-28");
  });

  it("fasce ai confini: esattamente 8 mesi è fascia 1, un giorno prima fascia 2; scaduto nessuna fascia", () => {
    expect(fasciaPerScadenza("2027-05-28", OGGI, fasce)?.sconto_percentuale).toBe(38);
    expect(fasciaPerScadenza("2027-05-27", OGGI, fasce)?.sconto_percentuale).toBe(40);
    expect(fasciaPerScadenza("2027-03-27", OGGI, fasce)?.sconto_percentuale).toBe(45);
    expect(fasciaPerScadenza(OGGI, OGGI, fasce)?.sconto_percentuale).toBe(45);
    expect(fasciaPerScadenza("2026-09-27", OGGI, fasce)).toBeNull();
  });

  it("sconto manuale sul lotto al posto della fascia; con promozione vale il migliore, non la somma", () => {
    expect(scontoPerLotto({ scadenza: "2028-01-01", oggi: OGGI, fasce, scontoManuale: 30 })).toMatchObject({ sconto: 30, origine: "lotto" });
    expect(scontoPerLotto({ scadenza: "2028-01-01", oggi: OGGI, fasce, promozione: { id: "p", sconto: 42 } })).toMatchObject({ sconto: 42, origine: "promozione" });
    expect(scontoPerLotto({ scadenza: "2028-01-01", oggi: OGGI, fasce, promozione: { id: "p", sconto: 20 } })).toMatchObject({ sconto: 38, origine: "fascia" });
  });

  it("totali: imponibile = Σ netto × quantità, IVA per aliquota sul totale imponibile", () => {
    const t = calcolaTotali([
      { quantita: 3, ivaPercentuale: 10, prezzi: calcolaPrezzi(6500, 10, 38) },
      { quantita: 2, ivaPercentuale: 22, prezzi: calcolaPrezzi(1000, 22, 45) },
    ]);
    expect(t.imponibileCent).toBe(3664 * 3 + 451 * 2);
    expect(t.ivaDettaglio).toEqual([
      { aliquota: 10, imponibileCent: 10992, ivaCent: 1099 },
      { aliquota: 22, imponibileCent: 902, ivaCent: 198 },
    ]);
    expect(t.totaleCent).toBe(10992 + 902 + 1099 + 198);
  });

  it("scadenza delle prenotazioni in giorni lavorativi (salta weekend e festivi)", () => {
    expect(aggiungiGiorniLavorativi("2026-09-30", 3)).toBe("2026-10-05"); // mer → lun
    expect(aggiungiGiorniLavorativi("2026-12-23", 3)).toBe("2026-12-29"); // 24, poi salta Natale, S. Stefano e domenica
    expect(aggiungiGiorniLavorativi("2027-03-26", 1)).toBe("2027-03-30"); // Pasquetta 29/03/2027
  });
});
