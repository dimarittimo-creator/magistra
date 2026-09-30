import { NextResponse, type NextRequest } from "next/server";
import { utenteCorrente } from "@/lib/auth";
import {
  ErroreChat,
  chiediOperatore,
  chiudiConversazione,
  conversazioneInCorso,
  decidiProposta,
  iniziaConversazione,
  inviaMessaggio,
} from "@/lib/chat/conversazioni";
import { modalitaAssistente } from "@/lib/chat/modello";
import { creaClientServer } from "@/lib/supabase/server";

export const maxDuration = 120;

// Chat dell'assistente per le farmacie attive.
// GET: conversazione in corso. POST { azione }: inizia, invia, proposta, operatore, nuova.
// Nei test automatici (solo in sviluppo) il cookie "magistra_assistente=prova" forza la modalità di prova.

async function farmaciaCollegata() {
  const utente = await utenteCorrente();
  if (!utente?.profilo || utente.profilo.ruolo !== "farmacia" || !utente.profilo.farmacia_id) return null;
  const db = await creaClientServer();
  const { data: attiva } = await db.rpc("farmacia_attiva");
  if (!attiva) return null;
  return { utente, db, farmaciaId: utente.profilo.farmacia_id };
}

const vietato = () => NextResponse.json({ errore: "Accesso non consentito" }, { status: 403 });

export async function GET() {
  const f = await farmaciaCollegata();
  if (!f) return vietato();
  const [conversazione, { data: imp }] = await Promise.all([
    conversazioneInCorso(f.db, f.utente.id),
    f.db.from("impostazioni").select("mesi_conservazione_chat").single(),
  ]);
  return NextResponse.json({ conversazione, mesiConservazione: imp?.mesi_conservazione_chat ?? 24 });
}

export async function POST(request: NextRequest) {
  const f = await farmaciaCollegata();
  if (!f) return vietato();
  const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const conversazioneId = typeof corpo.conversazioneId === "string" ? corpo.conversazioneId : "";
  let messaggio: string | undefined;

  try {
    switch (corpo.azione) {
      case "inizia": {
        const inCorso = await conversazioneInCorso(f.db, f.utente.id);
        if (inCorso?.richiestaAperta) throw new ErroreChat("Un operatore deve ancora risponderle nella conversazione in corso.");
        const prova = request.cookies.get("magistra_assistente")?.value === "prova";
        await iniziaConversazione({ utenteId: f.utente.id, farmaciaId: f.farmaciaId, modalita: modalitaAssistente({ provaRichiesta: prova }) });
        break;
      }
      case "invia": {
        const { data: farmacia } = await f.db.from("farmacie").select("ragione_sociale").eq("id", f.farmaciaId).single();
        await inviaMessaggio({
          db: f.db,
          utenteId: f.utente.id,
          farmaciaId: f.farmaciaId,
          nomeFarmacia: farmacia?.ragione_sociale ?? "",
          conversazioneId,
          testo: typeof corpo.testo === "string" ? corpo.testo : "",
        });
        break;
      }
      case "proposta":
        messaggio = await decidiProposta({
          db: f.db,
          utenteId: f.utente.id,
          farmaciaId: f.farmaciaId,
          propostaId: typeof corpo.propostaId === "string" ? corpo.propostaId : "",
          conferma: corpo.conferma === true,
        });
        break;
      case "operatore":
        await chiediOperatore(f.utente.id, conversazioneId);
        break;
      case "nuova":
        await chiudiConversazione(f.utente.id, conversazioneId);
        break;
      default:
        return NextResponse.json({ errore: "Azione non valida" }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof ErroreChat) return NextResponse.json({ errore: e.message }, { status: 422 });
    console.error("[assistente]", e);
    return NextResponse.json({ errore: "Si è verificato un problema. Riprovi." }, { status: 500 });
  }

  return NextResponse.json({ conversazione: await conversazioneInCorso(f.db, f.utente.id), messaggio });
}
