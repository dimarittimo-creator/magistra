import { excelMagazzino } from "@/lib/documents/excel-magazzino";
import { autorizza, file, nonAutorizzato } from "@/lib/download";
import { oggiRoma } from "@/lib/date";
import { creaClientServer } from "@/lib/supabase/server";

export async function GET() {
  if (!(await autorizza("admin", "operatore"))) return nonAutorizzato();
  const db = await creaClientServer();
  return file(await excelMagazzino(db), `magazzino-magistra-${oggiRoma()}.xlsx`, "xlsx");
}