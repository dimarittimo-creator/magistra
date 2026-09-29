// Formati italiani: euro con virgola decimale, date gg/mm/aaaa.
// Gli importi nel database sono in centesimi interi.
// Le date si mostrano sempre nel fuso di Roma, anche quando il server gira in UTC.

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const FUSO = "Europe/Rome";

const data = new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric" });
const ora = new Intl.DateTimeFormat("it-IT", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });

export function formattaEuro(centesimi: number): string {
  return euro.format(centesimi / 100);
}

export function formattaData(valore: Date | string): string {
  return data.format(typeof valore === "string" ? new Date(valore) : valore);
}

/** gg/mm/aaaa hh:mm */
export function formattaDataOra(valore: Date | string): string {
  const d = typeof valore === "string" ? new Date(valore) : valore;
  return `${data.format(d)} ${ora.format(d)}`;
}
