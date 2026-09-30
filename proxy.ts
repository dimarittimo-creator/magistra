import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rinnova la sessione a ogni richiesta e rimanda all'accesso chi apre un'area riservata
// senza essere collegato. È solo un primo filtro: i permessi veri li controllano
// le pagine, le azioni e la Row Level Security del database.
const AREE_RISERVATE = ["/farmacia", "/admin", "/area", "/nuova-password", "/negozio/carrello", "/negozio/ordini", "/negozio/profilo"];

export async function proxy(request: NextRequest) {
  let risposta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(daImpostare, intestazioni) {
          for (const { name, value } of daImpostare) request.cookies.set(name, value);
          risposta = NextResponse.next({ request });
          for (const { name, value, options } of daImpostare) risposta.cookies.set(name, value, options);
          for (const [chiave, valore] of Object.entries(intestazioni ?? {})) risposta.headers.set(chiave, valore);
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const percorso = request.nextUrl.pathname;
  const riservata = AREE_RISERVATE.some((a) => percorso === a || percorso.startsWith(`${a}/`));

  if (riservata && !data?.claims) {
    const accesso = request.nextUrl.clone();
    accesso.pathname = "/accesso";
    accesso.search = "";
    accesso.searchParams.set("prossima", percorso);
    return NextResponse.redirect(accesso);
  }
  return risposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand/|icon.svg|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
