import Link from "next/link";
import { Disponibilita, PrezzoNegozio } from "@/components/negozio/PrezzoNegozio";
import { caricaNegozio, perIlCliente } from "@/lib/negozio";

export const metadata = { title: "Negozio" };

const normalizza = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default async function Negozio({ searchParams }: { searchParams: Promise<{ q?: string; linea?: string; bloccato?: string }> }) {
  const filtri = await searchParams;
  const negozio = await caricaNegozio();
  const prodotti = negozio.prodotti.map(perIlCliente);
  const linee = [...new Map(prodotti.filter((p) => p.linea).map((p) => [p.linea!.id, p.linea!])).values()];
  const q = normalizza(filtri.q ?? "");
  const elenco = prodotti
    .filter((p) => (!q || normalizza(`${p.nome} ${p.formato ?? ""}`).includes(q)) && (!filtri.linea || p.linea?.id === filtri.linea))
    .sort((a, b) => Number(b.disponibile) - Number(a.disponibile) || a.nome.localeCompare(b.nome));
  const inOfferta = prodotti.some((p) => p.prezzo.scontoPercentuale > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      {filtri.bloccato && <p className="avviso avviso-errore">Il tuo account non è attivo: scrivi all&apos;assistenza per informazioni.</p>}
      <header>
        <h1 className="text-3xl sm:text-4xl text-magistra-blu">
          Il negozio Magistra
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-3 text-muted max-w-2xl">
          Gli integratori di Sagè Pharma e Bioeleva, spediti a casa tua.{inOfferta && " Questo mese alcuni prodotti sono in offerta."}
        </p>
      </header>

      <form role="search" action="/negozio" className="flex flex-col sm:flex-row gap-3">
        <label htmlFor="q" className="sr-only">Cerca un prodotto</label>
        <input id="q" name="q" defaultValue={filtri.q} placeholder="Cerca un prodotto" className="input sm:max-w-sm" />
        {linee.length > 0 && (
          <>
            <label htmlFor="linea" className="sr-only">Linea</label>
            <select id="linea" name="linea" defaultValue={filtri.linea ?? ""} className="select sm:max-w-xs">
              <option value="">Tutte le linee</option>
              {linee.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </>
        )}
        <button type="submit" className="btn btn-primary">Cerca</button>
      </form>

      {elenco.length === 0 ? (
        <p className="panel p-6 text-muted">Nessun prodotto trovato.</p>
      ) : (
        <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {elenco.map((p) => (
            <li key={p.codice}>
              <Link href={`/negozio/${p.codice}`} className={`panel p-5 flex flex-col gap-3 h-full no-underline text-ink hover:border-brand ${p.disponibile ? "" : "opacity-70"}`}>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-xl font-serif leading-snug">{p.nome}</h2>
                  <Disponibilita disponibile={p.disponibile} />
                </div>
                {p.formato && <p className="text-sm text-muted">{p.formato}</p>}
                <div className="mt-auto"><PrezzoNegozio prezzo={p.prezzo} /></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
