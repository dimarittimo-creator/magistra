import Link from "next/link";
import { richiediMedicoAttivo } from "@/lib/auth";
import { leggiSchede } from "@/lib/medici/contenuti";

export const metadata = { title: "Schede prodotto" };

const minuscolo = (s: string) => s.toLocaleLowerCase("it-IT").normalize("NFD").replace(/[̀-ͯ]/g, "");

export default async function SchedeProdotto({ searchParams }: { searchParams: Promise<{ q?: string; area?: string }> }) {
  await richiediMedicoAttivo();
  const { q = "", area = "" } = await searchParams;
  const tutte = await leggiSchede();
  const aree = [...new Set(tutte.map((s) => s.area).filter((a): a is string => !!a))].sort((a, b) => a.localeCompare(b, "it"));
  const parole = minuscolo(q).split(/\s+/).filter(Boolean);
  const schede = tutte.filter(
    (s) =>
      (!area || s.area === area) &&
      parole.every((p) => minuscolo([s.nome, s.formato, s.linea, s.area, s.descrizione].filter(Boolean).join(" ")).includes(p)),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <h1 className="text-3xl text-magistra-blu">
        Schede prodotto
        <span className="filetto" aria-hidden="true" />
      </h1>
      <p className="mt-3 text-muted">Informazioni approvate da Sagè Pharma e Bioeleva. Integratori alimentari: non sostituiscono una dieta variata ed equilibrata.</p>

      <form className="mt-6 flex flex-wrap gap-3 items-end" role="search">
        <div className="flex-1 min-w-[12rem]">
          <label htmlFor="q" className="etichetta">Cerca</label>
          <input id="q" name="q" defaultValue={q} className="input" placeholder="Nome, linea, ingrediente…" />
        </div>
        {aree.length > 0 && (
          <div>
            <label htmlFor="area" className="etichetta">Area terapeutica</label>
            <select id="area" name="area" defaultValue={area} className="select">
              <option value="">Tutte</option>
              {aree.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="btn btn-secondary">Cerca</button>
      </form>

      <p className="mt-4 text-sm text-muted" role="status">{schede.length === 1 ? "1 prodotto" : `${schede.length} prodotti`}</p>
      <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {schede.map((s) => (
          <li key={s.codice} className="panel p-5 flex flex-col">
            <h2 className="text-lg text-magistra-blu">
              <Link href={`/medici/prodotti/${s.codice}`}>{s.nome}</Link>
            </h2>
            <p className="text-sm text-muted">{[s.formato, s.linea, s.area].filter(Boolean).join(" · ")}</p>
            {s.descrizione && <p className="mt-2 text-sm line-clamp-3 flex-1">{s.descrizione}</p>}
            <Link href={`/medici/prodotti/${s.codice}`} className="mt-4 text-sm font-semibold self-start">Apri la scheda →</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
