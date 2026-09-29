import "server-only";
import { creaClientServer } from "@/lib/supabase/server";

export type TipoDocumentoLegale = "privacy" | "condizioni_farmacie" | "condizioni_privati";

export type DocumentoLegale = {
  id: string;
  tipo: TipoDocumentoLegale;
  versione: number;
  titolo: string;
  testo: string;
  provvisorio: boolean;
  in_vigore_dal: string;
};

/** Versione in vigore di un testo legale (informativa privacy, condizioni di vendita). */
export async function documentoCorrente(tipo: TipoDocumentoLegale): Promise<DocumentoLegale | null> {
  const db = await creaClientServer();
  const { data } = await db
    .from("documenti_legali")
    .select("id, tipo, versione, titolo, testo, provvisorio, in_vigore_dal")
    .eq("tipo", tipo)
    .lte("in_vigore_dal", new Date().toISOString())
    .order("versione", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as DocumentoLegale | null) ?? null;
}
