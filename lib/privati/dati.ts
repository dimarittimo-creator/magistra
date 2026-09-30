// Lettura e controllo dei dati di un cliente privato (docs/AREA_PRIVATI.md §1).
import { leggi, leggiIndirizzo } from "@/lib/farmacie/dati";
import { codiceFiscaleValido, emailValida, telefonoValido } from "@/lib/validazione";

export type DatiPrivato = { nome: string; cognome: string; codice_fiscale: string; email: string; telefono: string };

/** Con `anagrafica: false` (profilo) nome, cognome e codice fiscale non si leggono. */
export function leggiDatiPrivato(fd: FormData, opzioni: { anagrafica: boolean }) {
  const errori: Record<string, string> = {};
  const dati: Partial<DatiPrivato> = {
    email: leggi(fd, "email").toLowerCase(),
    telefono: leggi(fd, "telefono"),
  };
  if (opzioni.anagrafica) {
    dati.nome = leggi(fd, "nome");
    dati.cognome = leggi(fd, "cognome");
    dati.codice_fiscale = leggi(fd, "codice_fiscale").replace(/\s/g, "").toUpperCase();
    if (!dati.nome) errori.nome = "Indica il nome";
    if (!dati.cognome) errori.cognome = "Indica il cognome";
    if (!/^[A-Z0-9]{16}$/.test(dati.codice_fiscale) || !codiceFiscaleValido(dati.codice_fiscale)) errori.codice_fiscale = "Codice fiscale non valido (16 caratteri)";
  }
  if (!emailValida(dati.email!)) errori.email = "Indirizzo email non valido";
  if (!telefonoValido(dati.telefono!)) errori.telefono = "Numero di telefono non valido";
  const spedizione = leggiIndirizzo(fd, "consegna", errori);
  const fatturazione = fd.get("fatturazione_uguale") ? { ...spedizione } : leggiIndirizzo(fd, "fatturazione", errori);
  return { dati, spedizione, fatturazione, errori };
}
