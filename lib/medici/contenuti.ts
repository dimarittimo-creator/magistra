import "server-only";
import { creaClientAdmin } from "@/lib/supabase/admin";

// Contenuti dell'area Medici (docs/AREA_MEDICI.md §2). I medici non leggono la tabella prodotti:
// le schede si leggono qui dal server con i soli campi informativi, mai prezzi, lotti o giacenze.
// Chi chiama queste funzioni deve aver già verificato il medico con richiediMedicoAttivo().

export type SchedaMedico = {
  codice: string;
  nome: string;
  formato: string | null;
  descrizione: string | null;
  linea: string | null;
  area: string | null;
};

export type TestoScheda = { id: string; titolo: string; testo: string };

export type MaterialeMedico = {
  id: string;
  titolo: string;
  descrizione: string | null;
  tipo: string;
  prodotto_codice: string | null;
  file_nome: string;
  dimensione_byte: number | null;
  creato_il: string;
};

export const TIPI_MATERIALE: Record<string, string> = {
  studio: "Studio scientifico",
  brochure: "Brochure",
  scheda_tecnica: "Scheda tecnica",
  altro: "Documento",
};

const CAMPI_SCHEDA = "codice, nome, formato, descrizione, linea:linea_id(nome), area:area_id(nome)";

type RigaScheda = { codice: string; nome: string; formato: string | null; descrizione: string | null; linea: { nome: string } | null; area: { nome: string } | null };
const versoScheda = (p: RigaScheda): SchedaMedico => ({
  codice: p.codice,
  nome: p.nome,
  formato: p.formato,
  descrizione: p.descrizione,
  linea: p.linea?.nome ?? null,
  area: p.area?.nome ?? null,
});

export async function leggiSchede(): Promise<SchedaMedico[]> {
  const { data } = await creaClientAdmin().from("prodotti").select(CAMPI_SCHEDA).eq("attivo", true).order("nome");
  return ((data ?? []) as unknown as RigaScheda[]).map(versoScheda);
}

export async function leggiScheda(codice: string): Promise<{ scheda: SchedaMedico; testi: TestoScheda[]; materiali: MaterialeMedico[] } | null> {
  if (!/^[0-9]{9}$/.test(codice)) return null;
  const admin = creaClientAdmin();
  const { data } = await admin.from("prodotti").select(CAMPI_SCHEDA).eq("codice", codice).eq("attivo", true).maybeSingle();
  if (!data) return null;
  const [{ data: testi }, materiali] = await Promise.all([
    admin
      .from("kb_documenti")
      .select("id, titolo, testo")
      .eq("prodotto_codice", codice)
      .eq("stato", "approvato")
      .in("pubblico", ["medici", "tutti"])
      .order("titolo"),
    leggiMateriali({ prodotto: codice }),
  ]);
  return { scheda: versoScheda(data as unknown as RigaScheda), testi: (testi ?? []) as TestoScheda[], materiali };
}

/** Solo materiale pubblicato. */
export async function leggiMateriali(filtro: { prodotto?: string } = {}): Promise<MaterialeMedico[]> {
  let q = creaClientAdmin()
    .from("materiali_medici")
    .select("id, titolo, descrizione, tipo, prodotto_codice, file_nome, dimensione_byte, creato_il")
    .eq("pubblicato", true)
    .order("creato_il", { ascending: false });
  if (filtro.prodotto) q = q.eq("prodotto_codice", filtro.prodotto);
  const { data } = await q;
  return (data ?? []) as MaterialeMedico[];
}

export function formattaDimensione(byte: number | null): string {
  if (!byte) return "";
  return byte >= 1048576 ? `${(byte / 1048576).toLocaleString("it-IT", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(byte / 1024))} KB`;
}

export const STATI_CAMPIONE: Record<string, { testo: string; classe: string }> = {
  nuova: { testo: "Ricevuta", classe: "pill-warn" },
  in_lavorazione: { testo: "In lavorazione", classe: "pill-warn" },
  spedita: { testo: "Spedita", classe: "pill-ok" },
  non_accolta: { testo: "Non accolta", classe: "pill-bad" },
};
