import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dataDaNomeFile, leggiGiacenzaDeposito, leggiScadenza, normalizzaCodice } from "@/lib/import/giacenza";
import { leggiListino } from "@/lib/import/listino";

const giacenza = leggiGiacenzaDeposito(readFileSync("dati/giacenza_esempio_21-09-2026.xls"));

describe("Giacenza del deposito (file Crystal di esempio)", () => {
  it("legge 47 prodotti, 64 lotti e 90.297 pezzi senza errori", () => {
    expect(giacenza.errori).toEqual([]);
    expect(giacenza.totali.prodotti).toBe(47);
    expect(giacenza.totali.lotti).toBe(64);
    expect(giacenza.totali.pezzi).toBe(90297);
  });

  it("trova la difformità di ELIVID (297 + 2.020 = 2.317 contro 2.314)", () => {
    const difformi = giacenza.prodotti.filter((p) => p.difforme);
    expect(difformi.map((p) => p.descrizione)).toEqual(["ELIVID 60CPR"]);
    expect(difformi[0].somma_lotti).toBe(2317);
    expect(difformi[0].totale_dichiarato).toBe(2314);
  });

  it("trova i 2 lotti senza scadenza (Riparase crema e Riparase Plus)", () => {
    const senza = giacenza.prodotti.filter((p) => p.lotti.some((l) => !l.scadenza)).map((p) => p.descrizione);
    expect(giacenza.totali.senza_scadenza).toBe(2);
    expect(senza).toEqual(["RIPARASE CREMA 50ML", "RIPARASE PLUS CREMA 100ML"]);
  });

  it("conserva i codici lotto esattamente come sono e legge le scadenze senza spostamenti di fuso", () => {
    const angerex = giacenza.prodotti.find((p) => p.codice === "921178240")!;
    expect(angerex.lotti.map((l) => l.codice_lotto)).toEqual(["A4284", "a6082"]);
    const adegen = giacenza.prodotti.find((p) => p.codice === "983389420")!;
    expect(adegen.lotti[0].scadenza).toBe("2027-12-31");
    expect(adegen.codice_interno).toBe("4 - 01 - 0 - 4");
  });

  it("regole di lettura", () => {
    expect(normalizzaCodice(12345678)).toBe("012345678");
    expect(normalizzaCodice("983389420")).toBe("983389420");
    expect(normalizzaCodice("abc")).toBeNull();
    expect(leggiScadenza(0)).toBeNull();
    expect(leggiScadenza(null)).toBeNull();
    expect(leggiScadenza("31/12/2027")).toBe("2027-12-31");
    expect(dataDaNomeFile("giacenza_esempio_21-09-2026.xls")).toBe("2026-09-21");
  });
});

describe("Listino di esempio", () => {
  it("legge i prezzi al pubblico IVA inclusa in centesimi e ignora la riga TOTALE", async () => {
    const listino = await leggiListino(readFileSync("dati/listino_esempio.xlsx"), "Stima Chiusura 2026");
    expect(listino.errori).toEqual([]);
    expect(listino.voci.find((v) => v.codice === "983389420")?.prezzo_pubblico_cent).toBe(2250);
    expect(listino.voci.some((v) => v.nome.toUpperCase() === "TOTALE")).toBe(false);
  });

  it("gli 8 prodotti senza prezzo sono quelli indicati nella documentazione", async () => {
    const listino = await leggiListino(readFileSync("dati/listino_esempio.xlsx"), "Stima Chiusura 2026");
    const conPrezzo = new Set(listino.voci.map((v) => v.codice));
    const senzaPrezzo = giacenza.prodotti.filter((p) => !conPrezzo.has(p.codice)).map((p) => p.descrizione.split(" ")[0]);
    expect(senzaPrezzo.sort()).toEqual(["INFANTUSS", "NIAGARA", "OMEGAREX", "REGENERIS", "RIPARASE", "RIPARASE", "SPARTA", "VITABIM"]);
  });
});
