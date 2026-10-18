import { richiediMedicoAttivo } from "@/lib/auth";
import { formattaData } from "@/lib/formato";
import { TIPI_MATERIALE, formattaDimensione, leggiMateriali, leggiSchede } from "@/lib/medici/contenuti";

export const metadata = { title: "Materiale scientifico" };

export default async function MaterialeScientifico() {
  await richiediMedicoAttivo();
  const [materiali, schede] = await Promise.all([leggiMateriali(), leggiSchede()]);
  const nomi = new Map(schede.map((s) => [s.codice, s.nome]));

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <h1 className="text-3xl text-magistra-blu">
        Materiale scientifico
        <span className="filetto" aria-hidden="true" />
      </h1>
      <p className="mt-3 text-muted">Documenti in PDF riservati ai medici: studi, brochure e schede tecniche.</p>
      {materiali.length ? (
        <ul className="mt-6 space-y-4">
          {materiali.map((m) => (
            <li key={m.id} className="panel p-5">
              <p className="text-xs text-muted">
                {TIPI_MATERIALE[m.tipo]}
                {m.prodotto_codice && nomi.get(m.prodotto_codice) ? ` · ${nomi.get(m.prodotto_codice)}` : ""} · {formattaData(m.creato_il)}
              </p>
              <h2 className="text-lg text-magistra-blu mt-1">{m.titolo}</h2>
              {m.descrizione && <p className="mt-1 text-sm">{m.descrizione}</p>}
              <a href={`/api/materiali/${m.id}`} className="btn btn-secondary btn-piccolo mt-3">
                Scarica il PDF{m.dimensione_byte ? ` (${formattaDimensione(m.dimensione_byte)})` : ""}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="avviso avviso-info mt-6">Al momento non ci sono documenti pubblicati. Torni a trovarci presto.</p>
      )}
    </div>
  );
}
