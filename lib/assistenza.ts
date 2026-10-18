import "server-only";
import { cache } from "react";
import { creaClientAdmin } from "@/lib/supabase/admin";

/** Email dell'assistenza dalle impostazioni (null se non impostata). Una lettura per richiesta. */
export const emailAssistenza = cache(async (): Promise<string | null> => {
  try {
    const { data } = await creaClientAdmin().rpc("email_assistenza");
    return (data as string | null) || null;
  } catch {
    return null;
  }
});
