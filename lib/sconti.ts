// Regole delle fasce di sconto (docs/REGOLE_COMMERCIALI.md §2): usate dal pannello admin
// (controllo mentre si scrive) e dal server (controllo prima di salvare).

export type FasciaModifica = { mesi_minimi: number; sconto_percentuale: number };

export function validaFasce(fasce: FasciaModifica[], iva: number): string[] {
  const errori: string[] = [];
  if (fasce.some((f) => !Number.isInteger(f.mesi_minimi) || f.mesi_minimi < 0)) errori.push("Ogni fascia deve avere un numero intero di mesi pari o superiore a 0.");
  if (fasce.some((f) => !Number.isFinite(f.sconto_percentuale) || f.sconto_percentuale < 0 || f.sconto_percentuale > 100)) errori.push("Ogni sconto deve essere tra 0% e 100%.");
  if (!fasce.some((f) => f.mesi_minimi === 0)) errori.push("Serve una fascia da 0 mesi, che copre i lotti con la scadenza più breve.");
  if (new Set(fasce.map((f) => f.mesi_minimi)).size !== fasce.length) errori.push("Due fasce hanno lo stesso numero di mesi.");
  if (!Number.isFinite(iva) || iva < 0 || iva > 100) errori.push("L'aliquota IVA predefinita deve essere tra 0% e 100%.");
  return errori;
}
