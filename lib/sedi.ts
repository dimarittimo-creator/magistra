// Sedi legali, operative e depositi (docs/SOCIETA_E_SEDI.md §2): etichette e lettura del modulo admin.
import { leggi } from "@/lib/farmacie/dati";
import { capValido, emailValida, provinciaValida } from "@/lib/validazione";

export type TipoSede = "legale" | "operativa" | "deposito";

export type Sede = {
  id: string;
  societa_id: string;
  tipo: TipoSede;
  nome: string;
  indirizzo: string;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  telefono: string | null;
  email: string | null;
  email_cc: string[];
  referente: string | null;
  orari: string | null;
  predefinito: boolean;
  operatore_id: string | null;
  attiva: boolean;
  note: string | null;
};

export const TIPI_SEDE: Record<TipoSede, string> = {
  legale: "Sede legale",
  operativa: "Sede operativa",
  deposito: "Deposito",
};

export const ETICHETTE_SEDE: Record<string, string> = {
  societa_id: "Società",
  tipo: "Tipo",
  nome: "Nome",
  indirizzo: "Indirizzo",
  cap: "CAP",
  citta: "Città",
  provincia: "Provincia",
  telefono: "Telefono",
  email: "Email",
  email_cc: "Email in copia",
  referente: "Referente",
  orari: "Orari",
  predefinito: "Deposito predefinito",
  operatore_id: "Operatore logistico",
  attiva: "Attiva",
  note: "Note",
};

export function leggiDatiSede(fd: FormData) {
  const errori: Record<string, string> = {};
  const tipo = leggi(fd, "tipo") as TipoSede;
  const deposito = tipo === "deposito";
  const emailCc = leggi(fd, "email_cc")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const dati = {
    societa_id: leggi(fd, "societa_id"),
    tipo,
    nome: leggi(fd, "nome"),
    indirizzo: leggi(fd, "indirizzo"),
    cap: leggi(fd, "cap"),
    citta: leggi(fd, "citta"),
    provincia: leggi(fd, "provincia").toUpperCase(),
    telefono: leggi(fd, "telefono") || null,
    email: leggi(fd, "email").toLowerCase() || null,
    email_cc: emailCc,
    referente: leggi(fd, "referente") || null,
    orari: leggi(fd, "orari") || null,
    predefinito: deposito && Boolean(fd.get("predefinito")),
    operatore_id: deposito ? leggi(fd, "operatore_id") || null : null,
    attiva: Boolean(fd.get("attiva")),
    note: leggi(fd, "note") || null,
  };

  if (!dati.societa_id) errori.societa_id = "Scegli la società";
  if (!(tipo in TIPI_SEDE)) errori.tipo = "Scegli il tipo di sede";
  if (!dati.nome) errori.nome = "Indica un nome riconoscibile";
  if (!dati.indirizzo) errori.indirizzo = "Indica via e numero civico";
  if (!capValido(dati.cap)) errori.cap = "Il CAP ha 5 cifre";
  if (!dati.citta) errori.citta = "Indica la città";
  if (!provinciaValida(dati.provincia)) errori.provincia = "Sigla di 2 lettere";
  if (dati.email && !emailValida(dati.email)) errori.email = "Email non valida";
  const ccErrate = emailCc.filter((e) => !emailValida(e));
  if (ccErrate.length) errori.email_cc = `Indirizzi non validi: ${ccErrate.join(", ")}`;
  if (dati.predefinito && !dati.attiva) errori.predefinito = "Il deposito predefinito deve essere attivo";
  if (deposito && dati.attiva && !dati.email) errori.email = "Serve l'email a cui inviare le richieste di evasione";

  return { dati, errori };
}
