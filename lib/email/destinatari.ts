import "server-only";
import { creaClientAdmin } from "@/lib/supabase/admin";

/** Indirizzi dell'amministrazione: quelli nelle impostazioni o, se vuoti, gli utenti admin. */
export async function emailAmministrazione(): Promise<string[]> {
  const db = creaClientAdmin();
  const { data: imp } = await db.from("impostazioni").select("email_notifiche_admin").maybeSingle();
  const impostati = (imp?.email_notifiche_admin as string[] | undefined)?.filter(Boolean) ?? [];
  if (impostati.length) return impostati;
  const { data: admin } = await db.from("profili_utente").select("email").eq("ruolo", "admin");
  return (admin ?? []).map((a) => a.email).filter((e): e is string => !!e);
}
