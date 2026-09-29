import { excelModelloVuoto } from "@/lib/documents/excel-magazzino";
import { autorizza, file, nonAutorizzato } from "@/lib/download";
import { creaClientServer } from "@/lib/supabase/server";

export async function GET() {
  if (!(await autorizza("admin"))) return nonAutorizzato();
  const db = await creaClientServer();
  const { data } = await db.from("sedi").select("nome").eq("predefinito", true).maybeSingle();
  return file(await excelModelloVuoto(data?.nome ?? "Deposito"), "modello-magazzino-magistra.xlsx", "xlsx");
}