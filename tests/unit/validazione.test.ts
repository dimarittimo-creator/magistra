import { describe, expect, it } from "vitest";
import { formattaIban, ibanValido, partitaIvaValida } from "@/lib/validazione";
import { formattaData, formattaEuro } from "@/lib/formato";

describe("IBAN", () => {
  // IBAN di esempio pubblico (non sono quelli delle società, che stanno solo nel database)
  it("accetta un IBAN italiano valido, anche con spazi e minuscole", () => {
    expect(ibanValido("IT60X0542811101000000123456")).toBe(true);
    expect(ibanValido("it60 x054 2811 1010 0000 0123 456")).toBe(true);
  });
  it("rifiuta cifre di controllo o lunghezza errate", () => {
    expect(ibanValido("IT61X0542811101000000123456")).toBe(false);
    expect(ibanValido("IT60X054281110100000012345")).toBe(false);
    expect(ibanValido("")).toBe(false);
  });
  it("formatta a gruppi di 4", () => {
    expect(formattaIban("IT60X0542811101000000123456")).toBe("IT60 X054 2811 1010 0000 0123 456");
  });
});

describe("Partita IVA", () => {
  it("accetta le partite IVA del gruppo e di CIENNE", () => {
    expect(partitaIvaValida("01698370994")).toBe(true);
    expect(partitaIvaValida("04363330277")).toBe(true);
    expect(partitaIvaValida("10664671210")).toBe(true);
  });
  it("rifiuta carattere di controllo errato o formato sbagliato", () => {
    expect(partitaIvaValida("01698370995")).toBe(false);
    expect(partitaIvaValida("1698370994")).toBe(false);
    expect(partitaIvaValida("0169837099A")).toBe(false);
  });
});

describe("Formati italiani", () => {
  it("euro con virgola decimale", () => {
    expect(formattaEuro(3664).replace(/\s/g, " ")).toBe("36,64 €");
  });
  it("date gg/mm/aaaa", () => {
    expect(formattaData(new Date(2026, 8, 28))).toBe("28/09/2026");
  });
});
