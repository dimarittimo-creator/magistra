import { excelOrdine, pdfDdtSimulato, pdfOrdine } from "@/lib/documents/ordine";
import { autorizza, file, nonAutorizzato } from "@/lib/download";
import { leggiOrdine } from "@/lib/ordini/lettura";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";

// Documenti dell'ordine: /api/ordini/<id>/documento/pdf | excel | ddt-simulato
// La farmacia scarica solo i propri ordini (RLS), lo staff tutti.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; tipo: string }> }) {
  if (!(await autorizza("farmacia", "admin", "operatore"))) return nonAutorizzato();
  const { id, tipo } = await params;
  const db = await creaClientServer();
  const ordine = await leggiOrdine(db, id);
  if (!ordine) return nonAutorizzato();

  const { data: doc } = await db.from("documenti_legali").select("versione, testo").eq("id", ordine.condizioni_documento_id).maybeSingle();
  const condizioni = doc ? { versione: doc.versione as number, testo: doc.testo as string } : null;
  const nome = `ordine-${ordine.numero}`;

  if (tipo === "pdf") return file(await pdfOrdine(ordine, condizioni), `${nome}.pdf`, "pdf", true);
  if (tipo === "excel") return file(await excelOrdine(ordine, condizioni), `${nome}.xlsx`, "xlsx");
  if (tipo === "ddt-simulato") {
    // Luogo di partenza: solo l'indirizzo del deposito (i dati dell'operatore logistico non vanno ai clienti)
    const { data: sede } = await creaClientAdmin().from("sedi").select("indirizzo, cap, citta, provincia").eq("id", ordine.deposito_id).single();
    const partenza = { indirizzo: sede ? `${sede.indirizzo} – ${sede.cap ?? ""} ${sede.citta ?? ""} (${sede.provincia ?? ""})` : "—" };
    return file(await pdfDdtSimulato(ordine, partenza, condizioni), `ddt-simulato-${ordine.numero}.pdf`, "pdf", true);
  }
  return nonAutorizzato();
}
