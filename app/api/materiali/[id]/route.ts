import { NextResponse } from "next/server";
import { autorizza, file, nonAutorizzato } from "@/lib/download";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";

// Download del materiale scientifico: medici approvati (solo documenti pubblicati) e staff (anche bozze).
// L'archivio "materiali" è privato: il file si legge solo da qui, dopo i controlli.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const utente = await autorizza("medico", "admin", "operatore");
  if (!utente) return nonAutorizzato();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ errore: "Documento non trovato" }, { status: 404 });

  // Lettura con i permessi dell'utente: la RLS lascia passare solo i documenti pubblicati ai medici attivi.
  const db = await creaClientServer();
  const { data: m } = await db.from("materiali_medici").select("file_path, file_nome").eq("id", id).maybeSingle();
  if (!m) return NextResponse.json({ errore: "Documento non trovato" }, { status: 404 });

  const { data: blob, error } = await creaClientAdmin().storage.from("materiali").download(m.file_path);
  if (error || !blob) return NextResponse.json({ errore: "Documento non disponibile" }, { status: 404 });
  const nome = m.file_nome.replace(/[^\w.\- ]+/g, "_");
  return file(new Uint8Array(await blob.arrayBuffer()), nome, "pdf", true);
}
