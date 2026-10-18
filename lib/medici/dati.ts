// Lettura e controllo dei dati di un medico (docs/AREA_MEDICI.md §1).
// Unico punto usato da iscrizione, profilo del medico e modifica dall'area admin.
import { leggi, leggiIndirizzo } from "@/lib/farmacie/dati";
import { emailValida, ERRORE_TELEFONO, normalizzaTelefono, provinciaValida, telefonoValido } from "@/lib/validazione";

export type DatiMedico = {
  nome: string;
  cognome: string;
  specializzazione: string;
  numero_iscrizione: string;
  ordine_provincia: string;
  email: string;
  telefono: string;
  struttura: string;
  presso: string;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
};

/** Con `identificativi: false` (profilo) nome, cognome e iscrizione all'Ordine non si leggono: li corregge l'amministrazione. */
export function leggiDatiMedico(fd: FormData, opzioni: { identificativi: boolean }) {
  const errori: Record<string, string> = {};
  const dati: Partial<DatiMedico> = {
    email: leggi(fd, "email").toLowerCase(),
    telefono: normalizzaTelefono(leggi(fd, "telefono")),
    specializzazione: leggi(fd, "specializzazione"),
    struttura: leggi(fd, "struttura"),
  };
  if (opzioni.identificativi) {
    dati.nome = leggi(fd, "nome");
    dati.cognome = leggi(fd, "cognome");
    dati.numero_iscrizione = leggi(fd, "numero_iscrizione").replace(/\s/g, "");
    dati.ordine_provincia = leggi(fd, "ordine_provincia").toUpperCase();
    if (!dati.nome) errori.nome = "Indica il nome";
    if (!dati.cognome) errori.cognome = "Indica il cognome";
    if (!/^[0-9A-Za-z/.\-]{1,20}$/.test(dati.numero_iscrizione)) errori.numero_iscrizione = "Indica il numero di iscrizione all'Ordine";
    if (!provinciaValida(dati.ordine_provincia)) errori.ordine_provincia = "Sigla di 2 lettere della provincia dell'Ordine (es. NA)";
  }
  if (dati.specializzazione!.length < 2) errori.specializzazione = "Indica la specializzazione (es. Medicina generale)";
  if (!emailValida(dati.email!)) errori.email = "Indirizzo email non valido";
  if (!telefonoValido(dati.telefono!)) errori.telefono = ERRORE_TELEFONO;
  const ind = leggiIndirizzo(fd, "studio", errori);
  Object.assign(dati, { presso: ind.presso, indirizzo: ind.indirizzo, cap: ind.cap, citta: ind.citta, provincia: ind.provincia });
  return { dati, errori };
}

/** Indirizzo di spedizione dei campioni, come fotografia nella richiesta. */
export function indirizzoMedico(m: {
  nome: string;
  cognome: string;
  struttura: string | null;
  presso: string | null;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
}) {
  return {
    destinatario: `Dott. ${m.nome} ${m.cognome}`,
    struttura: m.struttura || null,
    presso: m.presso || null,
    indirizzo: m.indirizzo,
    cap: m.cap,
    citta: m.citta,
    provincia: m.provincia,
  };
}

export const STATI_MEDICO: Record<string, { testo: string; classe: string }> = {
  in_attesa: { testo: "In attesa di approvazione", classe: "pill-warn" },
  attivo: { testo: "Attivo", classe: "pill-ok" },
  bloccato: { testo: "Non attivo", classe: "pill-bad" },
};

/** Valori iniziali dei campi del modulo (nomi come in CampiMedico). */
export function valoriMedico(m: Record<string, unknown>): Record<string, string> {
  const s = (k: string) => (m[k] == null ? "" : String(m[k]));
  return {
    nome: s("nome"),
    cognome: s("cognome"),
    specializzazione: s("specializzazione"),
    numero_iscrizione: s("numero_iscrizione"),
    ordine_provincia: s("ordine_provincia"),
    email: s("email"),
    telefono: s("telefono"),
    struttura: s("struttura"),
    studio_presso: s("presso"),
    studio_indirizzo: s("indirizzo"),
    studio_cap: s("cap"),
    studio_citta: s("citta"),
    studio_provincia: s("provincia"),
  };
}

/** Campi che il medico (e l'admin) aggiornano dal modulo; i dati identificativi solo l'admin. */
export function campiAggiornabili(dati: Partial<DatiMedico>) {
  return {
    specializzazione: dati.specializzazione,
    email: dati.email,
    telefono: dati.telefono,
    struttura: dati.struttura || null,
    presso: dati.presso || null,
    indirizzo: dati.indirizzo,
    cap: dati.cap,
    citta: dati.citta,
    provincia: dati.provincia,
  };
}
