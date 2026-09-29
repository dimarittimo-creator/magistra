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

const DISPARI_CF = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23];

/**
 * Codice fiscale: 11 cifre (società, uguale alla partita IVA) oppure 16 caratteri
 * (persona fisica, omocodie comprese) con carattere di controllo.
 */
export function codiceFiscaleValido(input: string): boolean {
  const cf = input.replace(/\s+/g, "").toUpperCase();
  if (/^\d{11}$/.test(cf)) return partitaIvaValida(cf);
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) return false;
  let somma = 0;
  for (let i = 0; i < 15; i++) {
    const c = cf.charCodeAt(i);
    const v = c <= 57 ? c - 48 : c - 65;
    somma += i % 2 === 0 ? DISPARI_CF[v] : v;
  }
  return String.fromCharCode(65 + (somma % 26)) === cf[15];
}

/** Codice destinatario SDI: 7 caratteri alfanumerici. */
export function sdiValido(input: string): boolean {
  return /^[A-Z0-9]{7}$/.test(input.trim().toUpperCase());
}

export function emailValida(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

export function capValido(input: string): boolean {
  return /^\d{5}$/.test(input.trim());
}

/** Sigla della provincia: due lettere (NA, MI, …). */
export function provinciaValida(input: string): boolean {
  return /^[A-Z]{2}$/.test(input.trim().toUpperCase());
}

/** Telefono: almeno 6 cifre, sono ammessi spazi, trattini, punti e il prefisso +. */
export function telefonoValido(input: string): boolean {
  const t = input.trim();
  return /^\+?[\d\s./-]+$/.test(t) && t.replace(/\D/g, "").length >= 6;
}

/** Stessa regola di Supabase Auth (config.toml): almeno 8 caratteri, lettere e numeri. */
export function passwordValida(input: string): boolean {
  return input.length >= 8 && /[A-Za-z]/.test(input) && /\d/.test(input);
}

/** Mostra l'IBAN a gruppi di 4 caratteri, come sui documenti. */
export function formattaIban(iban: string): string {
  return normalizzaIban(iban).replace(/(.{4})/g, "$1 ").trim();
}
