import Link from "next/link";
import { BadgeStatoOrdine } from "@/components/ordini/DettaglioOrdine";
import { richiediStaff } from "@/lib/auth";
import { formattaDataOra, formattaEuro } from "@/lib/formato";
import { ETICHETTE_STATO_ORDINE, type StatoOrdine } from "@/lib/ordini/stati";
import { creaClientServer } from "@/lib/supabase/server";

export const metadata = { title: "Ordini" };

export default async function OrdiniAdmin({ searchParams }: { searchParams: Promise<{ stato?: string }> }) {
  await richiediStaff();
  const { stato } = await searchParams;
  const filtro = stato && stato in ETICHETTE_STATO_ORDINE ? (stato as StatoOrdine) : null;
  const db = await creaClientServer();
  let q = db
    .from("ordini")
    .select("id, numero, stato, creato_il, scade_il, totale_cent, snapshot_cliente, snapshot_societa")
    .order("creato_il", { ascending: false })
    .limit(300);
  if (filtro) q = q.eq("stato", filtro);
  const { data } = await q;
  const ordini = (data ?? []) as unknown as {
    id: string;
    numero: string;
    stato: StatoOrdine;
    creato_il: string;
    scade_il: string | null;
    totale_cent: number;
    snapshot_cliente: { ragione_sociale: string; consegna: { citta: string } | null };
    snapshot_societa: { nome_breve: string };
  }[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Ordini
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted max-w-3xl">
          Prenotazioni delle farmacie: apri un ordine per confermarlo, modificarlo, rifiutarlo, inviarlo al deposito o registrare il DDT.
        </p>
      </header>

      <nav aria-label="Filtra per stato" className="flex flex-wrap gap-2">
        <Link href="/admin/ordini" aria-current={!filtro ? "page" : undefined} className={`btn btn-piccolo ${!filtro ? "btn-primary" : "btn-secondary"}`}>Tutti</Link>
        {(["inviato", "in_verifica", "confermato", "modificato", "inviato_deposito", "in_preparazione", "spedito", "consegnato", "rifiutato", "scaduto"] as StatoOrdine[]).map((s) => (
          <Link key={s} href={`/admin/ordini?stato=${s}`} aria-current={filtro === s ? "page" : undefined}
            className={`btn btn-piccolo ${filtro === s ? "btn-primary" : "btn-secondary"}`}>
            {ETICHETTE_STATO_ORDINE[s].testo}
          </Link>
        ))}
      </nav>
      <p>
        <a href={`/api/admin/ordini/export${filtro ? `?stato=${filtro}` : ""}`} className="btn btn-secondary btn-piccolo">Esporta in Excel</a>
      </p>

      <div className="panel p-4 sm:p-6 overflow-x-auto">
        {ordini.length === 0 ? (
          <p className="text-muted">Nessun ordine.</p>
        ) : (
          <table className="tabella min-w-[760px]">
            <thead>
              <tr>
                <th>Numero</th>
                <th>Data</th>
                <th>Farmacia</th>
                <th>Fattura</th>
                <th className="text-right">Totale</th>
                <th>Stato</th>
                <th>Scade il</th>
              </tr>
            </thead>
            <tbody>
              {ordini.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/ordini/${o.id}`} className="font-semibold">{o.numero}</Link></td>
                  <td className="whitespace-nowrap">{formattaDataOra(o.creato_il)}</td>
                  <td>
                    {o.snapshot_cliente.ragione_sociale}
                    {o.snapshot_cliente.consegna && <div className="text-xs text-muted">{o.snapshot_cliente.consegna.citta}</div>}
                  </td>
                  <td>{o.snapshot_societa.nome_breve}</td>
                  <td className="text-right font-semibold">{formattaEuro(o.totale_cent)}</td>
                  <td><BadgeStatoOrdine stato={o.stato} /></td>
                  <td className="whitespace-nowrap text-sm">{(o.stato === "inviato" || o.stato === "in_verifica") && o.scade_il ? formattaDataOra(o.scade_il) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
