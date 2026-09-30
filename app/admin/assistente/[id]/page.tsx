import Link from "next/link";
import { notFound } from "next/navigation";
import { Messaggi } from "@/components/chat/Messaggi";
import { richiediStaff } from "@/lib/auth";
import { leggiConversazione } from "@/lib/chat/conversazioni";
import { formattaDataOra } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";
import { chiudiRichiesta } from "../azioni";
import { RispostaOperatore } from "../ModuliAssistente";

export const metadata = { title: "Conversazione con l'assistente" };

const MODALITA: Record<string, string> = {
  ai: "Assistente con intelligenza artificiale",
  prova: "Modalità di prova (risposte simulate)",
  solo_operatore: "Solo operatore (assistente automatico non attivo)",
};

export default async function Conversazione({ params }: { params: Promise<{ id: string }> }) {
  await richiediStaff();
  const { id } = await params;
  const db = await creaClientServer();
  const [vista, { data: info }, { data: strumenti }, { data: richieste }] = await Promise.all([
    leggiConversazione(db, id),
    db.from("conversazioni").select("creata_il, farmacia:farmacia_id(id, ragione_sociale, codice_farmacia)").eq("id", id).maybeSingle(),
    db.from("messaggi").select("strumenti, token_ingresso, token_uscita").eq("conversazione_id", id),
    db.from("richieste_operatore").select("id, motivo, stato, creata_il, chiusa_il").eq("conversazione_id", id).order("creata_il"),
  ]);
  if (!vista || !info) notFound();
  const farmacia = info.farmacia as unknown as { id: string; ragione_sociale: string; codice_farmacia: string | null } | null;
  const usati = [...new Set((strumenti ?? []).flatMap((m) => m.strumenti as string[]))];
  const token = (strumenti ?? []).reduce((s, m) => s + (m.token_ingresso ?? 0) + (m.token_uscita ?? 0), 0);

  return (
    <div className="space-y-6">
      <p>
        <Link href="/admin/assistente">← Richieste e conversazioni</Link>
      </p>
      <header>
        <h1 className="text-3xl text-magistra-blu">
          {farmacia ? <Link href={`/admin/farmacie/${farmacia.id}`}>{farmacia.ragione_sociale}</Link> : "Conversazione"}
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-3 text-sm text-muted">
          Iniziata il {formattaDataOra(info.creata_il)} · {MODALITA[vista.modalita]}
          {usati.length ? ` · Dati consultati: ${usati.join(", ")}` : ""}
          {token ? ` · ${token.toLocaleString("it-IT")} token` : ""}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr] items-start">
        <section className="panel p-4" aria-label="Messaggi">
          <Messaggi messaggi={vista.messaggi} collegamenti={false} nomeUtente={farmacia?.ragione_sociale} />
        </section>

        <div className="space-y-6">
          <section className="panel p-4 space-y-3" aria-labelledby="t-richieste">
            <h2 id="t-richieste" className="text-xl text-magistra-blu">
              Richieste di operatore
            </h2>
            {(richieste ?? []).length === 0 ? (
              <p className="text-sm text-muted">Il cliente non ha chiesto un operatore.</p>
            ) : (
              <ul className="text-sm space-y-2">
                {(richieste ?? []).map((r) => (
                  <li key={r.id}>
                    <span className={`pill ${r.stato === "aperta" ? "pill-warn" : "pill-off"}`}>{r.stato === "aperta" ? "Aperta" : "Chiusa"}</span> {r.motivo}
                    <br />
                    <span className="text-muted">
                      {formattaDataOra(r.creata_il)}
                      {r.chiusa_il ? ` – chiusa il ${formattaDataOra(r.chiusa_il)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {vista.richiestaAperta && (
              <form action={chiudiRichiesta.bind(null, id)}>
                <button type="submit" className="btn btn-secondary btn-piccolo">
                  Chiudi la richiesta senza rispondere
                </button>
              </form>
            )}
          </section>

          <section className="panel p-4" aria-labelledby="t-risposta">
            <h2 id="t-risposta" className="text-xl text-magistra-blu mb-3">
              Rispondi nella chat
            </h2>
            {vista.stato === "chiusa" ? (
              <p className="text-sm text-muted">Il cliente ha chiuso questa conversazione: non è più possibile rispondere qui.</p>
            ) : (
              <RispostaOperatore conversazioneId={id} richiestaAperta={vista.richiestaAperta} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
