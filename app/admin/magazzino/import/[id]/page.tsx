import Link from "next/link";
import { notFound } from "next/navigation";
import { richiediAdmin } from "@/lib/auth";
import { formattaData, formattaDataOra } from "@/lib/formato";
import type { Anteprima } from "@/lib/import/anteprima";
import { creaClientServer } from "@/lib/supabase/server";
import { ConfermaImport } from "./ConfermaImport";

export const metadata = { title: "Anteprima import" };

const CLASSI = { errore: "avviso-errore", attenzione: "avviso-attenzione", info: "avviso-info" } as const;

export default async function PaginaImport({ params }: { params: Promise<{ id: string }> }) {
  await richiediAdmin();
  const { id } = await params;
  const db = await creaClientServer();
  const { data: imp } = await db
    .from("import_magazzino")
    .select("id, tipo, file_nome, data_giacenza, stato, creato_il, applicato_il, riepilogo, avvisi, deposito:deposito_id(nome)")
    .eq("id", id)
    .maybeSingle();
  if (!imp) notFound();
  const a = imp.riepilogo as Anteprima | null;
  const deposito = (imp.deposito as unknown as { nome: string } | null)?.nome;
  const esito = Array.isArray(imp.avvisi) ? (imp.avvisi as string[]) : [];

  return (
    <div className="space-y-6">
      <p><Link href="/admin/magazzino">← Magazzino</Link></p>
      <header>
        <h1 className="text-3xl text-magistra-blu">
          {a?.titolo ?? "Import"}: {imp.file_nome}
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-3 text-muted">
          Caricato il {formattaDataOra(imp.creato_il)}
          {deposito && ` · ${deposito}`}
          {imp.data_giacenza && ` · giacenza del ${formattaData(imp.data_giacenza)}`}
        </p>
      </header>

      {a && (
        <ul className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {a.numeri.map((n) => (
            <li key={n.etichetta} className="panel p-4">
              <p className="text-sm text-muted">{n.etichetta}</p>
              <p className="text-2xl font-semibold">{n.valore}</p>
            </li>
          ))}
        </ul>
      )}

      {imp.stato === "applicato" && (
        <section className="avviso avviso-ok space-y-1">
          <p className="font-semibold">Applicato il {formattaDataOra(imp.applicato_il!)}.</p>
          {esito.map((x) => <p key={x}>{x}</p>)}
        </section>
      )}
      {imp.stato === "annullato" && <p className="avviso avviso-info">Import annullato: nessuna modifica è stata applicata.</p>}

      {a?.avvisi.map((av, i) => (
        <section key={i} className={`avviso ${CLASSI[av.gravita]}`}>
          <p className="font-semibold">{av.testo}</p>
          {av.dettagli && av.dettagli.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-sm">Mostra l&apos;elenco ({av.dettagli.length})</summary>
              <ul className="mt-2 text-sm list-disc pl-5 space-y-0.5">
                {av.dettagli.map((d) => <li key={d}>{d}</li>)}
              </ul>
            </details>
          )}
        </section>
      ))}

      {imp.stato === "anteprima" && (
        <section className="panel p-6">
          <ConfermaImport id={imp.id} bloccanti={a?.avvisi.filter((x) => x.gravita === "errore").length ?? 0} />
        </section>
      )}

      {a && a.differenze.length > 0 && (
        <section className="panel p-4 sm:p-6 overflow-x-auto" aria-labelledby="titolo-diff">
          <h2 id="titolo-diff" className="text-2xl text-magistra-blu mb-3">
            Cosa cambia ({a.differenze.length})
          </h2>
          <table className="tabella min-w-[560px]">
            <thead>
              <tr><th>Codice</th><th>Prodotto</th><th className="text-right">Prima</th><th className="text-right">Dopo</th></tr>
            </thead>
            <tbody>
              {a.differenze.map((d) => (
                <tr key={d.codice}>
                  <td>{d.codice}</td>
                  <td>{d.nome}</td>
                  <td className="text-right text-muted">{d.prima}</td>
                  <td className="text-right font-semibold">{d.dopo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
