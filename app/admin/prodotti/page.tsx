import Link from "next/link";
import { BadgeStatoProdotto } from "@/components/catalogo/Etichette";
import { richiediStaff } from "@/lib/auth";
import { caricaCatalogo } from "@/lib/catalogo";
import { formattaEuro } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";

export const metadata = { title: "Prodotti" };

export default async function Prodotti({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await richiediStaff();
  const { q } = await searchParams;
  const db = await creaClientServer();
  const catalogo = await caricaCatalogo(db, { includiNonVisibili: true });
  const cerca = (q ?? "").trim().toLowerCase();
  const prodotti = catalogo.prodotti.filter((p) => !cerca || `${p.nome} ${p.codice}`.toLowerCase().includes(cerca));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-magistra-blu">
            Prodotti
            <span className="filetto" aria-hidden="true" />
          </h1>
          <p className="mt-4 text-muted">Come li vedono oggi le farmacie. I prodotti senza prezzo non sono visibili.</p>
        </div>
        <form role="search" className="flex gap-2">
          <label htmlFor="q" className="sr-only">Cerca prodotto</label>
          <input id="q" name="q" defaultValue={q} placeholder="Nome o codice" className="input w-64" />
          <button className="btn btn-secondary" type="submit">Cerca</button>
        </form>
      </header>
      <div className="panel p-4 sm:p-6 overflow-x-auto">
        <table className="tabella min-w-[760px]">
          <thead>
            <tr><th>Prodotto</th><th>Linea</th><th className="text-right">Pubblico</th><th className="text-right">Disponibili</th><th className="text-right">Lotti</th><th>Stato</th></tr>
          </thead>
          <tbody>
            {prodotti.map((p) => (
              <tr key={p.codice}>
                <td>
                  <Link href={`/admin/prodotti/${p.codice}`} className="font-semibold">{p.nome}</Link>
                  <div className="text-xs text-muted">{p.codice}</div>
                </td>
                <td>{p.linea?.nome ?? "—"}</td>
                <td className="text-right">{p.prezzo_pubblico_cent == null ? <span className="pill pill-warn">Prezzo mancante</span> : formattaEuro(p.prezzo_pubblico_cent)}</td>
                <td className="text-right tabular-nums">{p.disponibile.toLocaleString("it-IT")}</td>
                <td className="text-right">{p.lotti.length}</td>
                <td><BadgeStatoProdotto stato={p.stato} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
