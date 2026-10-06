import { NextResponse, type NextRequest } from "next/server";
import { oggiRoma } from "@/lib/date";
import { inviaOrdiniAlDeposito } from "@/lib/deposito/invio";
import { emailAmministrazione } from "@/lib/email/destinatari";
import { inviaEmail } from "@/lib/email/invia";
import { emailSollecitoDdt } from "@/lib/email/modelli-ordini";
import { creaClientAdmin } from "@/lib/supabase/admin";

// Job pianificato (ogni 15 minuti):
// 1. invio cumulativo: se la modalità è "cumulativa", una volta al giorno dopo l'orario impostato
//    partono tutti gli ordini confermati, un'email per deposito;
// 2. sollecito DDT: ordini inviati al deposito da più di N ore senza DDT → avviso all'amministrazione
//    (al massimo uno al giorno per ordine).
export async function GET(request: NextRequest) {
  const segreto = process.env.CRON_SECRET;
  const autorizzato = segreto ? request.headers.get("authorization") === `Bearer ${segreto}` : process.env.NODE_ENV !== "production";
  if (!autorizzato) return NextResponse.json({ errore: "non autorizzato" }, { status: 401 });

  const db = creaClientAdmin();
  const { data: imp } = await db.from("impostazioni").select("modalita_invio_deposito, orario_invio_cumulativo, ultimo_invio_cumulativo, ore_sollecito_ddt").single();
  const risultato: { cumulativo?: unknown; solleciti: number } = { solleciti: 0 };

  const oggi = oggiRoma();
  const oraRoma = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const forza = request.nextUrl.searchParams.get("cumulativo") === "ora" && process.env.NODE_ENV !== "production";
  if (imp?.modalita_invio_deposito === "cumulativa" && (forza || (imp.ultimo_invio_cumulativo !== oggi && oraRoma >= String(imp.orario_invio_cumulativo).slice(0, 5)))) {
    const { data: confermati } = await db.from("ordini").select("id, canale, pagamento_ricevuto_il, snapshot_pagamento").in("stato", ["confermato", "modificato"]).eq("modifiche_da_accettare", false);
    // I privati con bonifico partono solo dopo il pagamento ricevuto; gli ordini modificati solo dopo l'accettazione del cliente
    const pronti = (confermati ?? []).filter((o) => !(o.canale === "privati" && (o.snapshot_pagamento as { richiede_iban: boolean }).richiede_iban && !o.pagamento_ricevuto_il));
    const esito = await inviaOrdiniAlDeposito(db, pronti.map((o) => o.id), { modalita: "cumulativa", utente: null });
    if (!esito.errori.length) await db.from("impostazioni").update({ ultimo_invio_cumulativo: oggi }).eq("id", true);
    risultato.cumulativo = esito;
  }

  const limite = new Date(Date.now() - (imp?.ore_sollecito_ddt ?? 48) * 3600_000).toISOString();
  const ieri = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: senzaDdt } = await db
    .from("ordini")
    .select("id, numero, inviato_deposito_il, sollecito_ddt_il, snapshot_cliente, deposito:deposito_id(nome)")
    .in("stato", ["inviato_deposito", "in_preparazione"])
    .lt("inviato_deposito_il", limite);
  const daSollecitare = (senzaDdt ?? []).filter((o) => !o.sollecito_ddt_il || o.sollecito_ddt_il < ieri);
  if (daSollecitare.length) {
    const partita = await inviaEmail(
      emailSollecitoDdt(
        await emailAmministrazione(),
        daSollecitare.map((o) => ({
          id: o.id,
          numero: o.numero,
          farmacia: (o.snapshot_cliente as { ragione_sociale: string }).ragione_sociale,
          inviato: o.inviato_deposito_il!,
          deposito: (o.deposito as unknown as { nome: string } | null)?.nome ?? "",
        })),
      ),
    );
    if (partita) {
      await db.from("ordini").update({ sollecito_ddt_il: new Date().toISOString() }).in("id", daSollecitare.map((o) => o.id));
      risultato.solleciti = daSollecitare.length;
    }
  }
  return NextResponse.json(risultato);
}
