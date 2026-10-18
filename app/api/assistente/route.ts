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
  type Interlocutore,
} from "@/lib/chat/conversazioni";
import { modalitaAssistente } from "@/lib/chat/modello";
import { creaClientServer } from "@/lib/supabase/server";

export const maxDuration = 120;

// Chat dell'assistente per le farmacie attive e per i medici approvati (docs/AREA_MEDICI.md).
// GET: conversazione in corso. POST { azione }: inizia, invia, proposta, operatore, nuova.
// Nei test automatici (solo in sviluppo) il cookie "magistra_assistente=prova" forza la modalità di prova.

async function farmaciaCollegata() {
  const utente = await utenteCorrente();
  const profilo = utente?.profilo;
  if (!utente || !profilo) return null;
  const db = await creaClientServer();
  if (profilo.ruolo === "farmacia" && profilo.farmacia_id) {
    const { data: attiva } = await db.rpc("farmacia_attiva");
    if (!attiva) return null;
    return { utente, db, farmaciaId: profilo.farmacia_id as string | undefined, medicoId: undefined as string | undefined };
  }
  if (profilo.ruolo === "medico" && profilo.medico_id) {
    const { data: attivo } = await db.rpc("medico_attivo");
    if (!attivo) return null;
    return { utente, db, farmaciaId: undefined, medicoId: profilo.medico_id };
  }
  return null;
}

async function interlocutore(f: NonNullable<Awaited<ReturnType<typeof farmaciaCollegata>>>): Promise<Interlocutore> {
  if (f.farmaciaId) {
    const { data: farmacia } = await f.db.from("farmacie").select("ragione_sociale").eq("id", f.farmaciaId).single();
    return { tipo: "farmacia", farmaciaId: f.farmaciaId, nome: farmacia?.ragione_sociale ?? "" };
  }
  const { data: medico } = await f.db.from("medici").select("nome, cognome, specializzazione").eq("id", f.medicoId!).single();
  return { tipo: "medico", medicoId: f.medicoId!, nome: medico ? `${medico.nome} ${medico.cognome}` : "", specializzazione: medico?.specializzazione ?? "" };
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
        await iniziaConversazione({ utenteId: f.utente.id, farmaciaId: f.farmaciaId, medicoId: f.medicoId, modalita: modalitaAssistente({ provaRichiesta: prova }) });
        break;
      }
      case "invia": {
        await inviaMessaggio({
          db: f.db,
          utenteId: f.utente.id,
          interlocutore: await interlocutore(f),
          conversazioneId,
          testo: typeof corpo.testo === "string" ? corpo.testo : "",
        });
        break;
      }
      case "proposta":
        if (!f.farmaciaId) return NextResponse.json({ errore: "Azione non valida" }, { status: 400 });
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
