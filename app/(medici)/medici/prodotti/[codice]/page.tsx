import Link from "next/link";
import { notFound } from "next/navigation";
import { richiediMedicoAttivo } from "@/lib/auth";
import { formattaData } from "@/lib/formato";
import { TIPI_MATERIALE, formattaDimensione, leggiScheda } from "@/lib/medici/contenuti";

export const metadata = { title: "Scheda prodotto" };

export default async function SchedaProdotto({ params }: { params: Promise<{ codice: string }> }) {
  await richiediMedicoAttivo();
  const { codice } = await params;
  const dati = await leggiScheda(codice);
  if (!dati) notFound();
  const { scheda, testi, materiali } = dati;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10 space-y-6">
      <p>
        <Link href="/medici/prodotti">← Tutte le schede</Link>
      </p>
      <header>
        <h1 className="text-3xl text-magistra-blu">
          {scheda.nome}
          <span className="filetto" aria-hidden="true" />
        </h1>
        <dl className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-[max-content_1fr] text-sm">
          {scheda.formato && (<><dt className="text-muted">Formato</dt><dd>{scheda.formato}</dd></>)}
          {scheda.linea && (<><dt className="text-muted">Linea</dt><dd>{scheda.linea}</dd></>)}
          {scheda.area && (<><dt className="text-muted">Area terapeutica</dt><dd>{scheda.area}</dd></>)}
          <dt className="text-muted">Codice ministeriale</dt>
          <dd>{scheda.codice}</dd>
        </dl>
      </header>

      {scheda.descrizione && (
        <section className="panel p-6">
          <h2 className="text-xl text-magistra-blu">Descrizione</h2>
          <p className="mt-3 whitespace-pre-line">{scheda.descrizione}</p>
        </section>
      )}

      {testi.map((t) => (
        <section key={t.id} className="panel p-6">
          <h2 className="text-xl text-magistra-blu">{t.titolo}</h2>
          <div className="mt-3 whitespace-pre-line text-sm leading-relaxed">{t.testo}</div>
        </section>
      ))}

      <section className="panel p-6" aria-labelledby="t-materiale">
        <h2 id="t-materiale" className="text-xl text-magistra-blu">Materiale scientifico</h2>
        {materiali.length ? (
          <ul className="mt-3 space-y-3">
            {materiali.map((m) => (
              <li key={m.id}>
                <a href={`/api/materiali/${m.id}`} className="font-semibold">{m.titolo}</a>
                <span className="text-sm text-muted"> · {TIPI_MATERIALE[m.tipo]} · PDF {formattaDimensione(m.dimensione_byte)} · {formattaData(m.creato_il)}</span>
                {m.descrizione && <p className="text-sm text-muted">{m.descrizione}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">Nessun documento per questo prodotto.</p>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href={`/medici/campioni?prodotto=${scheda.codice}`} className="btn btn-primary">Richiedi campioni</Link>
      </div>
      <p className="text-xs text-muted">
        Informazioni destinate ai medici. Gli integratori alimentari non sostituiscono una dieta variata ed equilibrata e uno stile di vita sano.
      </p>
    </div>
  );
}
