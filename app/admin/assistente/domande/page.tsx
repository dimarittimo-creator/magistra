import Link from "next/link";
import { richiediStaff } from "@/lib/auth";
import { formattaDataOra } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";
import { GestioneDomanda } from "../ModuliAssistente";
import { NavAssistente } from "../NavAssistente";

export const metadata = { title: "Assistente – domande senza risposta" };

export default async function DomandeSenzaRisposta({ searchParams }: { searchParams: Promise<{ tutte?: string }> }) {
  const utente = await richiediStaff();
  const { tutte } = await searchParams;
  const db = await creaClientServer();
  let q = db.from("domande_senza_risposta").select("id, domanda, stato, nota, creata_il, conversazione_id").order("creata_il", { ascending: false }).limit(200);
  if (!tutte) q = q.eq("stato", "da_valutare");
  const { data } = await q;
  const admin = utente.profilo.ruolo === "admin";

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <h1 className="text-3xl text-magistra-blu">
          Domande senza risposta
          <span className="filetto" aria-hidden="true" />
        </h1>
        <NavAssistente attiva="/admin/assistente/domande" admin={admin} />
        <p className="text-muted max-w-3xl">
          Domande a cui l&apos;assistente non ha trovato una risposta nei dati del portale o nella base di conoscenza approvata. Per coprirle, aggiungi o
          aggiorna un documento {admin ? <Link href="/admin/assistente/conoscenza">nella base di conoscenza</Link> : "nella base di conoscenza (lo fa un amministratore)"}{" "}
          e segna la domanda come risolta.
        </p>
        <p>
          {tutte ? <Link href="/admin/assistente/domande">Mostra solo quelle da valutare</Link> : <Link href="/admin/assistente/domande?tutte=1">Mostra anche quelle già gestite</Link>}
        </p>
      </header>

      <section className="panel p-6">
        {(data ?? []).length === 0 ? (
          <p className="text-muted">Nessuna domanda da valutare.</p>
        ) : (
          <ul className="divide-y divide-line">
            {(data ?? []).map((d) => (
              <li key={d.id} className="py-4 space-y-2">
                <p className="font-semibold">«{d.domanda}»</p>
                <p className="text-sm text-muted">
                  {formattaDataOra(d.creata_il)}
                  {d.conversazione_id && (
                    <>
                      {" · "}
                      <Link href={`/admin/assistente/${d.conversazione_id}`}>Vedi la conversazione</Link>
                    </>
                  )}
                </p>
                <GestioneDomanda id={d.id} stato={d.stato} nota={d.nota} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
