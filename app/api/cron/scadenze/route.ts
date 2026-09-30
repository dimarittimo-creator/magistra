import { NextResponse, type NextRequest } from "next/server";
import { oggiRoma } from "@/lib/date";
import { emailAmministrazione } from "@/lib/email/destinatari";
import { inviaEmail } from "@/lib/email/invia";
import { componi, sito } from "@/lib/email/modelli";
import { emailPrenotazioneScaduta } from "@/lib/email/modelli-ordini";
import type { SnapshotCliente } from "@/lib/ordini/lettura";
import { servePromemoria } from "@/lib/sconti-privati";
import { creaClientAdmin } from "@/lib/supabase/admin";

// Job pianificato (Vercel Cron, ogni 15 minuti):
// - le prenotazioni non confermate entro la scadenza passano a "Scaduto", la merce torna disponibile
//   e la farmacia riceve un'email;
// - 5 giorni prima della fine del mese, se il mese dopo non ha sconti privati, promemoria all'admin (una volta).
// - le conversazioni dell'assistente più vecchie del periodo di conservazione si cancellano.
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

  // Promemoria sconti privati del mese successivo
  const oggi = request.nextUrl.searchParams.get("oggi") && process.env.NODE_ENV !== "production" ? request.nextUrl.searchParams.get("oggi")! : oggiRoma();
  let promemoria = false;
  const { data: imp } = await db.from("impostazioni").select("ultimo_promemoria_sconti").single();
  if (imp?.ultimo_promemoria_sconti !== oggi) {
    const { data: sconti } = await db.from("sconti_privati").select("inizio, fine").gte("fine", oggi);
    if (servePromemoria(sconti ?? [], oggi)) {
      promemoria = await inviaEmail(
        componi(
          await emailAmministrazione(),
          "Magistra – Imposta gli sconti privati del mese prossimo",
          [
            "Il mese prossimo non ha ancora sconti per i clienti privati.",
            "Puoi copiare con un clic quelli di questo mese o crearne di nuovi.",
          ],
          { testo: "Apri gli sconti privati", url: `${sito()}/admin/sconti-privati` },
        ),
      );
      if (promemoria) await db.from("impostazioni").update({ ultimo_promemoria_sconti: oggi }).eq("id", true);
    }
  }

  // Chat dell'assistente oltre il periodo di conservazione (impostazioni.mesi_conservazione_chat)
  const { data: chatCancellate, error: errChat } = await db.rpc("cancella_conversazioni_scadute");
  if (errChat) console.error("[cron] cancellazione chat:", errChat.message);

  return NextResponse.json({ scaduti: ids.length, promemoria, chatCancellate: chatCancellate ?? 0 });
}
