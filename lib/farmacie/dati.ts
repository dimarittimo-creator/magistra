// Lettura e controllo dei dati di una farmacia inviati da un modulo.
// Unico punto usato da iscrizione, profilo della farmacia e modifica dall'area admin.
import {
  capValido,
  codiceFiscaleValido,
  emailValida,
  partitaIvaValida,
  provinciaValida,
  sdiValido,
  telefonoValido,
} from "@/lib/validazione";

export type StatoModulo = {
  ok?: boolean;
  messaggio?: string;
  errori?: Record<string, string>;
  valori?: Record<string, string>;
};

export type DatiIndirizzo = { presso: string; indirizzo: string; cap: string; citta: string; provincia: string };

export type DatiFarmacia = {
  ragione_sociale: string;
  titolare: string;
  partita_iva: string;
  codice_fiscale: string;
  codice_farmacia: string;
  sdi: string;
  pec: string;
  email: string;
  telefono: string;
};

export function leggi(fd: FormData, nome: string): string {
  const v = fd.get(nome);
  return typeof v === "string" ? v.trim() : "";
}

/** Valori testuali del modulo, per ripresentarli dopo un errore (mai le password). */
export function valoriModulo(fd: FormData): Record<string, string> {
  const valori: Record<string, string> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string" && !k.startsWith("$") && !k.toLowerCase().includes("password")) valori[k] = v;
  }
  return valori;
}

function leggiIndirizzo(fd: FormData, prefisso: string, errori: Record<string, string>): DatiIndirizzo {
  const ind: DatiIndirizzo = {
    presso: leggi(fd, `${prefisso}_presso`),
    indirizzo: leggi(fd, `${prefisso}_indirizzo`),
    cap: leggi(fd, `${prefisso}_cap`).replace(/\s/g, ""),
    citta: leggi(fd, `${prefisso}_citta`),
    provincia: leggi(fd, `${prefisso}_provincia`).toUpperCase(),
  };
  if (!ind.indirizzo) errori[`${prefisso}_indirizzo`] = "Indica via e numero civico";
  if (!capValido(ind.cap)) errori[`${prefisso}_cap`] = "Il CAP ha 5 cifre";
  if (!ind.citta) errori[`${prefisso}_citta`] = "Indica la città";
  if (!provinciaValida(ind.provincia)) errori[`${prefisso}_provincia`] = "Sigla di 2 lettere (es. NA)";
  return ind;
}

/**
 * Controlla i dati anagrafici e gli indirizzi.
 * Con `identificativi: false` (profilo della farmacia) ragione sociale, partita IVA,
 * codice fiscale e codice farmacia non si leggono: li modifica solo l'admin.
 */
export function leggiDatiFarmacia(fd: FormData, opzioni: { identificativi: boolean }) {
  const errori: Record<string, string> = {};

  const dati: Partial<DatiFarmacia> = {
    titolare: leggi(fd, "titolare"),
    sdi: leggi(fd, "sdi").toUpperCase(),
    pec: leggi(fd, "pec").toLowerCase(),
    email: leggi(fd, "email").toLowerCase(),
    telefono: leggi(fd, "telefono"),
  };
  if (opzioni.identificativi) {
    dati.ragione_sociale = leggi(fd, "ragione_sociale");
    dati.partita_iva = leggi(fd, "partita_iva").replace(/\s/g, "").replace(/^IT/i, "");
    dati.codice_fiscale = leggi(fd, "codice_fiscale").replace(/\s/g, "").toUpperCase();
    dati.codice_farmacia = leggi(fd, "codice_farmacia").replace(/\s/g, "").toUpperCase();

    if (!dati.ragione_sociale) errori.ragione_sociale = "Indica la ragione sociale";
    if (!partitaIvaValida(dati.partita_iva)) errori.partita_iva = "Partita IVA non valida (11 cifre)";
    if (!dati.codice_fiscale) dati.codice_fiscale = dati.partita_iva;
    else if (!codiceFiscaleValido(dati.codice_fiscale)) errori.codice_fiscale = "Codice fiscale non valido";
    if (!/^[A-Z0-9]{3,20}$/.test(dati.codice_farmacia)) errori.codice_farmacia = "Indica il codice identificativo della farmacia";
  }

  if (!dati.titolare) errori.titolare = "Indica il nome del titolare";
  if (dati.sdi && !sdiValido(dati.sdi)) errori.sdi = "Il codice SDI ha 7 caratteri";
  if (dati.pec && !emailValida(dati.pec)) errori.pec = "Indirizzo PEC non valido";
  if (!dati.sdi && !dati.pec) errori.sdi = "Indica il codice SDI oppure la PEC";
  if (!emailValida(dati.email!)) errori.email = "Indirizzo email non valido";
  if (!telefonoValido(dati.telefono!)) errori.telefono = "Numero di telefono non valido";

  const consegna = leggiIndirizzo(fd, "consegna", errori);
  const fatturazione = fd.get("fatturazione_uguale") ? { ...consegna } : leggiIndirizzo(fd, "fatturazione", errori);

  return { dati, consegna, fatturazione, errori };
}
