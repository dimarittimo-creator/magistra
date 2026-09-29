import Link from "next/link";
import { BadgeStatoProdotto } from "@/components/catalogo/Etichette";
import { richiediFarmaciaAttiva } from "@/lib/auth";
import { caricaCatalogo } from "@/lib/catalogo";
import { formattaEuro } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";

export const metadata = { title: "Catalogo" };

function normalizza(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default async function Catalogo({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; linea?: string; area?: string; disponibili?: string }>;
}) {
  const { farmaciaId } = await richiediFarmaciaAttiva();
  const filtri = await searchParams;
  const db = await creaClientServer();
  const catalogo = await caricaCatalogo(db, { farmaciaId });

  const linee = [...new Map(catalogo.prodotti.filter((p) => p.linea).map((p) => [p.linea!.id, p.linea!])).values()].sort((a, b) => a.nome.localeCompare(b.nome));
  const aree = [...new Map(catalogo.prodotti.filter((p) => p.area).map((p) => [p.area!.id, p.area!])).values()].sort((a, b) => a.nome.localeCompare(b.nome));

  const q = normalizza((filtri.q ?? "").trim());
  const soloDisponibili = filtri.disponibili === "1";
  const prodotti = catalogo.prodotti.filter(
    (p) =>
      (!q || normalizza(`${p.nome} ${p.codice} ${p.formato ?? ""}`).includes(q)) &&
      (!filtri.linea || p.linea?.id === filtri.linea) &&
      (!filtri.area || p.area?.id === filtri.area) &&
      (!soloDisponibili || p.disponibile > 0),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Catalogo
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-3 text-muted">
          Prezzi farmacia IVA esclusa, calcolati sulla scadenza di ogni lotto. Apri un prodotto per scegliere lotto e quantità.
        </p>
      </header>

      <form role="search" action="/farmacia/catalogo" className="panel p-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] items-end">
        <div>
          <label htmlFor="q" className="etichetta">Cerca</label>
          <input id="q" name="q" defaultValue={filtri.q} placeholder="Nome o codice minsan" className="input" />
        </div>
        {linee.length > 0 ? (
          <div>
            <label htmlFor="linea" className="etichetta">Linea</label>
            <select id="linea" name="linea" defaultValue={filtri.linea ?? ""} className="select">
              <option value="">Tutte</option>
              {linee.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </div>
        ) : <div className="hidden sm:block" />}
        {aree.length > 0 ? (
          <div>
            <label htmlFor="area" className="etichetta">Area terapeutica</label>
            <select id="area" name="area" defaultValue={filtri.area ?? ""} className="select">
              <option value="">Tutte</option>
              {aree.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
        ) : <div className="hidden sm:block" />}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm whitespace-nowrap">
            <input type="checkbox" name="disponibili" value="1" defaultChecked={soloDisponibili} className="size-5 accent-[var(--brand)]" />
            Solo disponibili
          </label>
          <button type="submit" className="btn btn-primary">Filtra</button>
        </div>
      </form>

      <p className="text-sm text-muted" role="status">
        {prodotti.length === 1 ? "1 prodotto" : `${prodotti.length} prodotti`}
      </p>

      {prodotti.length === 0 ? (
        <p className="panel p-6 text-muted">Nessun prodotto corrisponde alla ricerca.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prodotti.map((p) => (
            <li key={p.codice}>
              <Link href={`/farmacia/catalogo/${p.codice}`} className="panel p-5 flex flex-col gap-3 h-full no-underline text-ink hover:border-brand">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-sans font-semibold leading-snug">{p.nome}</h2>
                  <BadgeStatoProdotto stato={p.stato} />
                </div>
                <p className="text-sm text-muted">
                  Minsan {p.codice}
                  {p.linea && ` · ${p.linea.nome}`}
                </p>
                <div className="mt-auto flex items-end justify-between gap-3">
                  <div>
                    {p.prezzoMigliore ? (
                      <>
                        <p className="text-xs text-muted">da</p>
                        <p className="text-xl font-bold">{formattaEuro(p.prezzoMigliore.farmaciaNettoCent)}</p>
                        <p className="text-xs text-muted">IVA esclusa · al pubblico {formattaEuro(p.prezzo_pubblico_cent!)}</p>
                      </>
                    ) : (
                      <p className="text-sm text-muted">Al pubblico {formattaEuro(p.prezzo_pubblico_cent!)}</p>
                    )}
                  </div>
                  <p className="text-sm text-right">
                    <span className="font-semibold tabular-nums">{p.disponibile.toLocaleString("it-IT")}</span>
                    <span className="text-muted"> pz</span>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
