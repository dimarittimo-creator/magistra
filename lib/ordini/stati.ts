// Stati dell'ordine (docs/DEPOSITO_E_SPEDIZIONI.md): etichette sempre con testo, mai solo colore.

export type StatoOrdine =
  | "inviato"
  | "in_verifica"
  | "confermato"
  | "modificato"
  | "rifiutato"
  | "scaduto"
  | "inviato_deposito"
  | "in_preparazione"
  | "spedito"
  | "consegnato";

export const ETICHETTE_STATO_ORDINE: Record<StatoOrdine, { testo: string; classe: string; spiegazione: string }> = {
  inviato: { testo: "Inviato", classe: "pill-warn", spiegazione: "Prenotazione ricevuta, in attesa di conferma" },
  in_verifica: { testo: "In verifica", classe: "pill-warn", spiegazione: "La stiamo verificando" },
  confermato: { testo: "Confermato", classe: "pill-ok", spiegazione: "Ordine confermato" },
  modificato: { testo: "Modificato", classe: "pill-ok", spiegazione: "Confermato con alcune modifiche" },
  rifiutato: { testo: "Rifiutato", classe: "pill-bad", spiegazione: "Ordine non accettato" },
  scaduto: { testo: "Scaduto", classe: "pill-off", spiegazione: "Non confermato entro i termini: la merce è tornata disponibile" },
  inviato_deposito: { testo: "Inviato al deposito", classe: "pill-ok", spiegazione: "In attesa di preparazione" },
  in_preparazione: { testo: "In preparazione", classe: "pill-ok", spiegazione: "Il deposito sta preparando la merce" },
  spedito: { testo: "Spedito", classe: "pill-ok", spiegazione: "Merce in viaggio" },
  consegnato: { testo: "Consegnato", classe: "pill-ok", spiegazione: "Merce consegnata" },
};

export const STATI_APERTI: StatoOrdine[] = ["inviato", "in_verifica", "confermato", "modificato", "inviato_deposito", "in_preparazione"];
