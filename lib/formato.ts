// Formati italiani: euro con virgola decimale, date gg/mm/aaaa.
// Gli importi nel database sono in centesimi interi.

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

export function formattaEuro(centesimi: number): string {
  return euro.format(centesimi / 100);
}

export function formattaData(data: Date | string): string {
  const d = typeof data === "string" ? new Date(data) : data;
  const gg = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${gg}/${mm}/${d.getFullYear()}`;
}
