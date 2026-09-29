import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client con la sessione dell'utente collegato (cookie): rispetta la Row Level Security.
// È il client da usare di norma in pagine e azioni.
export async function creaClientServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chiave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chiave) {
    throw new Error("Configurazione Supabase mancante: esegui «npm run db:env» per creare .env.local.");
  }
  const archivio = await cookies();
  return createServerClient(url, chiave, {
    cookies: {
      getAll: () => archivio.getAll(),
      setAll(daImpostare) {
        // Nelle pagine (Server Component) i cookie non si possono scrivere: ci pensa proxy.ts.
        try {
          for (const { name, value, options } of daImpostare) archivio.set(name, value, options);
        } catch {}
      },
    },
  });
}
