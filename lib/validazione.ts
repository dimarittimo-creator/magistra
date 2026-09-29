// Controlli formali su dati fiscali e bancari. Gli stessi controlli esistono nel database
// (funzioni iban_valido e partita_iva_valida) così un dato non valido non si salva da nessuna parte.

/** Toglie spazi e porta in maiuscolo: "it60 x054 ..." → "IT60X054...". */
export function normalizzaIban(iban: string): string {
  return iban.replace(/\s+/g, "").toUpperCase();
}

/** IBAN valido: formato, lunghezza italiana (27) e cifre di controllo (mod 97). */
export function ibanValido(input: string): boolean {
  const iban = normalizzaIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("IT") && iban.length !== 27) return false;
  const riordinato = iban.slice(4) + iban.slice(0, 4);
  let resto = 0;
  for (const c of riordinato) {
    const n = c >= "A" && c <= "Z" ? String(c.charCodeAt(0) - 55) : c;
    for (const d of n) resto = (resto * 10 + Number(d)) % 97;
  }
  return resto === 1;
}

/** Partita IVA italiana: 11 cifre con carattere di controllo. */
export function partitaIvaValida(input: string): boolean {
  const p = input.replace(/\s+/g, "");
  if (!/^\d{11}$/.test(p)) return false;
  let somma = 0;
  for (let i = 0; i < 11; i++) {
    let d = Number(p[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    somma += d;
  }
  return somma % 10 === 0;
}

/** Mostra l'IBAN a gruppi di 4 caratteri, come sui documenti. */
export function formattaIban(iban: string): string {
  return normalizzaIban(iban).replace(/(.{4})/g, "$1 ").trim();
}
