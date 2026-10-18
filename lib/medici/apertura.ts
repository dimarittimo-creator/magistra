import "server-only";
import { creaClientAdmin } from "@/lib/supabase/admin";

/** Area Medici aperta al pubblico? In locale sempre sì; online lo decide l'admin in Impostazioni. */
export async function areaMediciAperta(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return true;
  const { data } = await creaClientAdmin().from("impostazioni").select("area_medici_attiva").single();
  return Boolean(data?.area_medici_attiva);
}
