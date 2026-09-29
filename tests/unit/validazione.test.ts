import { describe, expect, it } from "vitest";
import {
  capValido,
  codiceFiscaleValido,
  emailValida,
  formattaIban,
  ibanValido,
  partitaIvaValida,
  passwordValida,
  provinciaValida,
  sdiValido,
  telefonoValido,
} from "@/lib/validazione";
import { formattaData, formattaDataOra, formattaEuro } from "@/lib/formato";

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

describe("Codice fiscale", () => {
  it("accetta persona fisica, omocodia e codice numerico di società", () => {
    expect(codiceFiscaleValido("RSSMRA85T10A562S")).toBe(true);
    expect(codiceFiscaleValido("rssmra85t10a562s")).toBe(true);
    expect(codiceFiscaleValido("RSSMRA85T10A56NH")).toBe(true);
    expect(codiceFiscaleValido("01698370994")).toBe(true);
  });
  it("rifiuta carattere di controllo o formato errati", () => {
    expect(codiceFiscaleValido("RSSMRA85T10A562T")).toBe(false);
    expect(codiceFiscaleValido("RSSMRA85Z10A562S")).toBe(false);
    expect(codiceFiscaleValido("01698370995")).toBe(false);
    expect(codiceFiscaleValido("")).toBe(false);
  });
});

describe("Altri controlli del modulo di iscrizione", () => {
  it("SDI, CAP, provincia, email, telefono", () => {
    expect(sdiValido("m5uxcr1")).toBe(true);
    expect(sdiValido("M5UXCR")).toBe(false);
    expect(capValido("80122")).toBe(true);
    expect(capValido("8012")).toBe(false);
    expect(provinciaValida("na")).toBe(true);
    expect(provinciaValida("NAP")).toBe(false);
    expect(emailValida("farmacia@esempio.it")).toBe(true);
    expect(emailValida("farmacia@esempio")).toBe(false);
    expect(telefonoValido("+39 081 1234567")).toBe(true);
    expect(telefonoValido("12ab")).toBe(false);
  });
  it("password: almeno 8 caratteri con lettere e numeri", () => {
    expect(passwordValida("farmacia2026")).toBe(true);
    expect(passwordValida("farmacia")).toBe(false);
    expect(passwordValida("f2026")).toBe(false);
  });
});

describe("Formati italiani", () => {
  it("euro con virgola decimale", () => {
    expect(formattaEuro(3664).replace(/\s/g, " ")).toBe("36,64 €");
  });
  it("date gg/mm/aaaa", () => {
    expect(formattaData(new Date(2026, 8, 28))).toBe("28/09/2026");
  });
  it("data e ora nel fuso di Roma, anche da un server in UTC", () => {
    expect(formattaDataOra("2026-09-28T22:30:00Z")).toBe("29/09/2026 00:30");
  });
});
