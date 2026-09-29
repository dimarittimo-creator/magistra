// Società emittenti (docs/SOCIETA_E_SEDI.md): etichette dei campi e lettura del modulo admin.
import { leggi, type StatoModulo } from "@/lib/farmacie/dati";
import {
  capValido,
  codiceFiscaleValido,
  emailValida,
  ibanValido,
  normalizzaIban,
  partitaIvaValida,
  provinciaValida,
  sdiValido,
} from "@/lib/validazione";

export type Societa = {
  id: string;
  codice: string;
  ragione_sociale: string;
  nome_breve: string;
  sede_legale_indirizzo: string;
  sede_legale_cap: string;
  sede_legale_citta: string;
  sede_legale_provincia: string;
  partita_iva: string;
  codice_fiscale: string;
  sdi: string | null;
  pec: string | null;
  rea: string | null;
  capitale_sociale_testo: string | null;
  sito: string | null;
  email: string | null;
  telefono: string | null;
  iban: string | null;
  logo_path: string | null;
  piede_documenti: string | null;
  attiva_farmacie: boolean;
  attiva_privati: boolean;
  predefinita: boolean;
  attiva: boolean;
  note: string | null;
};

export const ETICHETTE_SOCIETA: Record<string, string> = {
  ragione_sociale: "Ragione sociale",
  nome_breve: "Nome breve",
  sede_legale_indirizzo: "Sede legale – indirizzo",
  sede_legale_cap: "Sede legale – CAP",
  sede_legale_citta: "Sede legale – città",
  sede_legale_provincia: "Sede legale – provincia",
  partita_iva: "Partita IVA",
  codice_fiscale: "Codice fiscale",
  sdi: "Codice SDI",
  pec: "PEC",
  rea: "REA",
  capitale_sociale_testo: "Capitale sociale",
  sito: "Sito",
  email: "Email amministrazione",
  telefono: "Telefono",
  iban: "IBAN",
  logo_path: "Logo",
  piede_documenti: "Piè di pagina dei documenti",
  attiva_farmacie: "Attiva per le farmacie",
  attiva_privati: "Attiva per i privati",
  predefinita: "Predefinita",
  attiva: "Attiva",
  note: "Note",
};

const testo = (fd: FormData, nome: string) => leggi(fd, nome) || null;

export function leggiDatiSocieta(fd: FormData) {
  const errori: StatoModulo["errori"] & object = {};
  const iban = normalizzaIban(leggi(fd, "iban"));
  const dati = {
    ragione_sociale: leggi(fd, "ragione_sociale"),
    nome_breve: leggi(fd, "nome_breve"),
    sede_legale_indirizzo: leggi(fd, "sede_legale_indirizzo"),
    sede_legale_cap: leggi(fd, "sede_legale_cap"),
    sede_legale_citta: leggi(fd, "sede_legale_citta"),
    sede_legale_provincia: leggi(fd, "sede_legale_provincia").toUpperCase(),
    partita_iva: leggi(fd, "partita_iva").replace(/\s/g, ""),
    codice_fiscale: leggi(fd, "codice_fiscale").replace(/\s/g, "").toUpperCase(),
    sdi: testo(fd, "sdi")?.toUpperCase() ?? null,
    pec: testo(fd, "pec")?.toLowerCase() ?? null,
    rea: testo(fd, "rea"),
    capitale_sociale_testo: testo(fd, "capitale_sociale_testo"),
    sito: testo(fd, "sito"),
    email: testo(fd, "email")?.toLowerCase() ?? null,
    telefono: testo(fd, "telefono"),
    iban: iban || null,
    piede_documenti: testo(fd, "piede_documenti"),
    attiva_farmacie: Boolean(fd.get("attiva_farmacie")),
    attiva_privati: Boolean(fd.get("attiva_privati")),
    predefinita: Boolean(fd.get("predefinita")),
    attiva: Boolean(fd.get("attiva")),
    note: testo(fd, "note"),
  };

  if (!dati.ragione_sociale) errori.ragione_sociale = "Indica la ragione sociale";
  if (!dati.nome_breve) errori.nome_breve = "Indica il nome da mostrare nel portale";
  if (!dati.sede_legale_indirizzo) errori.sede_legale_indirizzo = "Indica l'indirizzo della sede legale";
  if (!capValido(dati.sede_legale_cap)) errori.sede_legale_cap = "Il CAP ha 5 cifre";
  if (!dati.sede_legale_citta) errori.sede_legale_citta = "Indica la città";
  if (!provinciaValida(dati.sede_legale_provincia)) errori.sede_legale_provincia = "Sigla di 2 lettere";
  if (!partitaIvaValida(dati.partita_iva)) errori.partita_iva = "Partita IVA non valida";
  if (!codiceFiscaleValido(dati.codice_fiscale)) errori.codice_fiscale = "Codice fiscale non valido";
  if (dati.sdi && !sdiValido(dati.sdi)) errori.sdi = "Il codice SDI ha 7 caratteri";
  if (dati.pec && !emailValida(dati.pec)) errori.pec = "PEC non valida";
  if (dati.email && !emailValida(dati.email)) errori.email = "Email non valida";
  if (dati.iban && !ibanValido(dati.iban)) errori.iban = "IBAN non valido: controlla lunghezza e cifre di controllo";
  if (dati.predefinita && !dati.attiva) errori.predefinita = "La società predefinita deve essere attiva";

  return { dati, errori };
}
