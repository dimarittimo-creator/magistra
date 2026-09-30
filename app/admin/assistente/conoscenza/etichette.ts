// Etichette della base di conoscenza (elenco e scheda del documento).

export const TIPI_KB: Record<string, string> = { scheda_prodotto: "Scheda prodotto", faq: "Domande frequenti", documento: "Documento" };
export const PUBBLICI_KB: Record<string, string> = {
  tutti: "Tutti",
  farmacie: "Solo farmacie",
  privati: "Solo privati",
  medici: "Solo medici (futuro assistente)",
};
export const STATI_KB: Record<string, { testo: string; classe: string }> = {
  bozza: { testo: "Bozza – non usato", classe: "pill-warn" },
  approvato: { testo: "Approvato – in uso", classe: "pill-ok" },
  archiviato: { testo: "Archiviato", classe: "pill-off" },
};
