import { TestoLegale } from "@/components/TestoLegale";
import { richiediAdmin } from "@/lib/auth";
import type { DocumentoLegale } from "@/lib/documenti-legali";
import { formattaData } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";
import { FormVersione } from "./FormVersione";

export const metadata = { title: "Condizioni e privacy" };

const TIPI = [
  { tipo: "condizioni_farmacie", nome: "Condizioni di vendita farmacie", url: "/condizioni/farmacie" },
  { tipo: "privacy", nome: "Informativa privacy", url: "/privacy" },
  { tipo: "condizioni_privati", nome: "Condizioni di vendita privati", url: "/condizioni/privati" },
] as const;

export default async function Documenti() {
  await richiediAdmin();
  const db = await creaClientServer();
  const { data } = await db.from("documenti_legali").select("id, tipo, versione, titolo, testo, provvisorio, in_vigore_dal").order("versione", { ascending: false });
  const documenti = (data ?? []) as DocumentoLegale[];
  const adesso = new Date().toISOString();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Condizioni e privacy
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted max-w-3xl">
          Ogni modifica crea una nuova versione. Le versioni precedenti restano: ogni ordine e ogni consenso ricorda quella accettata.
        </p>
      </header>
      {TIPI.map((t) => {
        const versioni = documenti.filter((d) => d.tipo === t.tipo);
        const corrente = versioni.find((d) => d.in_vigore_dal <= adesso);
        return (
          <section key={t.tipo} className="panel p-6 space-y-4" aria-labelledby={`t-${t.tipo}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id={`t-${t.tipo}`} className="text-2xl text-magistra-blu">{t.nome}</h2>
              <a href={t.url} target="_blank" rel="noreferrer" className="text-sm">Vedi la pagina pubblica</a>
            </div>
            {corrente ? (
              <details>
                <summary className="cursor-pointer">
                  In vigore: versione {corrente.versione} dal {formattaData(corrente.in_vigore_dal)}{" "}
                  {corrente.provvisorio && <span className="pill pill-warn">Provvisoria</span>}
                </summary>
                <div className="mt-4 rounded-lg border border-line p-4 text-sm"><TestoLegale documento={corrente} /></div>
              </details>
            ) : (
              <p className="avviso avviso-attenzione">Nessuna versione in vigore.</p>
            )}
            {versioni.length > 1 && (
              <p className="text-sm text-muted">
                Versioni: {versioni.map((v) => `${v.versione} (${formattaData(v.in_vigore_dal)})`).join(" · ")}
              </p>
            )}
            <details>
              <summary className="cursor-pointer font-semibold text-brand">Scrivi una nuova versione</summary>
              <div className="mt-4">
                <FormVersione tipo={t.tipo} titolo={corrente?.titolo ?? t.nome} testo={corrente?.testo ?? ""} />
              </div>
            </details>
          </section>
        );
      })}
    </div>
  );
}
