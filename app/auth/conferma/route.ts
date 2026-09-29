import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { percorsoSicuro } from "@/lib/auth";
import { creaClientServer } from "@/lib/supabase/server";

// Link delle email di Supabase (conferma indirizzo, recupero password):
// verifica il codice e collega l'utente, poi lo porta alla pagina indicata.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const prossima = percorsoSicuro(searchParams.get("next"));

  if (tokenHash && tipo) {
    const db = await creaClientServer();
    const { error } = await db.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(prossima, request.url));
  }
  return NextResponse.redirect(new URL("/accesso?esito=link", request.url));
}
