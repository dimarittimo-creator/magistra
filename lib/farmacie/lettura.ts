import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StatoFarmacia = "in_attesa" | "attiva" | "bloccata";

export type Indirizzo = {
  id: string;
  tipo: "consegna" | "fatturazione";
  presso: string | null;
  indirizzo: string;
  cap: string;
  citta: string;
  provincia: string;
};

export type Farmacia = {
  id: string;
  ragione_sociale: string;
  titolare: string;
  partita_iva: string;
  codice_fiscale: string;
  codice_farmacia: string;
  sdi: string | null;
  pec: string | null;
  email: string;
  telefono: string;
  stato: StatoFarmacia;
  gruppo_id: string | null;
  societa_predefinita_id: string | null;
  approvata_il: string | null;
  bloccata_il: string | null;
  motivo_blocco: string | null;
  note_admin: string | null;
  creato_il: string;
  indirizzi: Indirizzo[];
};

export const ETICHETTE_STATO: Record<StatoFarmacia, { testo: string; classe: string }> = {
  in_attesa: { testo: "In attesa", classe: "pill-warn" },
  attiva: { testo: "Attiva", classe: "pill-ok" },
  bloccata: { testo: "Bloccata", classe: "pill-bad" },
};

/** Farmacia con i suoi indirizzi (la RLS decide chi può leggerla). */
export async function leggiFarmacia(db: SupabaseClient, id: string): Promise<Farmacia | null> {
  const { data } = await db
    .from("farmacie")
    .select("*, indirizzi(id, tipo, presso, indirizzo, cap, citta, provincia)")
    .eq("id", id)
    .maybeSingle();
  return (data as Farmacia | null) ?? null;
}

export function indirizzoDi(f: Farmacia, tipo: Indirizzo["tipo"]): Indirizzo | undefined {
  return f.indirizzi.find((i) => i.tipo === tipo);
}

/** Valori per precompilare i campi di CampiFarmacia. */
export function valoriFarmacia(f: Farmacia): Record<string, string> {
  const v: Record<string, string> = {
    ragione_sociale: f.ragione_sociale,
    titolare: f.titolare,
    partita_iva: f.partita_iva,
    codice_fiscale: f.codice_fiscale,
    codice_farmacia: f.codice_farmacia,
    sdi: f.sdi ?? "",
    pec: f.pec ?? "",
    email: f.email,
    telefono: f.telefono,
  };
  for (const tipo of ["consegna", "fatturazione"] as const) {
    const i = indirizzoDi(f, tipo);
    if (!i) continue;
    v[`${tipo}_presso`] = i.presso ?? "";
    v[`${tipo}_indirizzo`] = i.indirizzo;
    v[`${tipo}_cap`] = i.cap;
    v[`${tipo}_citta`] = i.citta;
    v[`${tipo}_provincia`] = i.provincia;
  }
  const c = indirizzoDi(f, "consegna");
  const fa = indirizzoDi(f, "fatturazione");
  const uguali =
    !!c && !!fa && c.indirizzo === fa.indirizzo && c.cap === fa.cap && c.citta === fa.citta && c.provincia === fa.provincia && (c.presso ?? "") === (fa.presso ?? "");
  if (uguali) v.fatturazione_uguale = "on";
  else v.fatturazione_uguale = "";
  return v;
}

export function formattaIndirizzo(i: Indirizzo | undefined): string {
  if (!i) return "—";
  return `${i.presso ? `c/o ${i.presso}, ` : ""}${i.indirizzo} – ${i.cap} ${i.citta} (${i.provincia})`;
}
