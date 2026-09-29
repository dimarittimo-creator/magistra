import "server-only";
import { createClient } from "@supabase/supabase-js";

// Client con chiave di servizio: ignora la Row Level Security.
// Usarlo solo lato server, per operazioni di sistema (seed, job, pagine di controllo).
export function creaClientAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chiave) {
    throw new Error("Configurazione Supabase mancante: esegui «npm run db:env» per creare .env.local.");
  }
  return createClient(url, chiave, { auth: { persistSession: false, autoRefreshToken: false } });
}
