import { NextResponse, type NextRequest } from "next/server";
import { inviaEmail } from "@/lib/email/invia";
import { emailPrenotazioneScaduta } from "@/lib/email/modelli-ordini";
import type { SnapshotCliente } from "@/lib/ordini/lettura";
import { creaClientAdmin } from "@/lib/supabase/admin";

// Job pianificato (Vercel Cron, ogni 15 minuti): le prenotazioni non confermate entro la
// scadenza passano a "Scaduto", la merce torna disponibile e la farmacia riceve un'email.
// Protetto da CRON_SECRET (Vercel lo invia come "Authorization: Bearer …").
export async function GET(request: NextRequest) {
  const segreto = process.env.CRON_SECRET;
  const autorizzato = segreto
    ? request.headers.get("authorization") === `Bearer ${segreto}`
    : process.env.NODE_ENV !== "production";
  if (!autorizzato) return NextResponse.json({ errore: "non autorizzato" }, { status: 401 });

  const db = creaClientAdmin();
  const { data: scaduti, error } = await db.rpc("scadi_prenotazioni");
  if (error) return NextResponse.json({ errore: error.message }, { status: 500 });

  const ids = ((scaduti ?? []) as { ordine_id: string }[]).map((s) => s.ordine_id);
  if (ids.length) {
    const { data: ordini } = await db.from("ordini").select("id, numero, snapshot_cliente").in("id", ids);
    await Promise.all(
      (ordini ?? []).map((o) => inviaEmail(emailPrenotazioneScaduta({ id: o.id, numero: o.numero, snapshot_cliente: o.snapshot_cliente as SnapshotCliente }))),
    );
  }
  return NextResponse.json({ scaduti: ids.length });
}
