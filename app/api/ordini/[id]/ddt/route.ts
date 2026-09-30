import { autorizza, file, nonAutorizzato } from "@/lib/download";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";

// Download del DDT reale: la farmacia solo per i propri ordini (RLS), lo staff per tutti.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await autorizza("farmacia", "privato", "admin", "operatore"))) return nonAutorizzato();
  const { id } = await params;
  const db = await creaClientServer();
  const { data: sped } = await db.from("spedizioni").select("ddt_numero, ddt_pdf_path").eq("ordine_id", id).maybeSingle();
  if (!sped?.ddt_pdf_path) return nonAutorizzato();
  const { data } = await creaClientAdmin().storage.from("ddt").download(sped.ddt_pdf_path);
  if (!data) return nonAutorizzato();
  return file(new Uint8Array(await data.arrayBuffer()), `DDT-${sped.ddt_numero.replace(/[^\w-]/g, "_")}.pdf`, "pdf", true);
}
