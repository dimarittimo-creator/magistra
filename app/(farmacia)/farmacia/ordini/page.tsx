import Link from "next/link";
import { BadgeStatoOrdine } from "@/components/ordini/DettaglioOrdine";
import { richiediFarmaciaAttiva } from "@/lib/auth";
import { formattaData, formattaEuro } from "@/lib/formato";
import type { StatoOrdine } from "@/lib/ordini/stati";
import { creaClientServer } from "@/lib/supabase/server";

export const metadata = { title: "I miei ordini" };

export default async function MieiOrdini() {
  const { farmaciaId } = await richiediFarmaciaAttiva();
  const db = await creaClientServer();
  const { data } = await db
    .from("ordini")
    .select("id, numero, stato, creato_il, totale_cent, snapshot_societa, righe:righe_ordine(count)")
    .eq("farmacia_id", farmaciaId)
    .order("creato_il", { ascending: false })
    .limit(200);
  const ordini = (data ?? []) as unknown as {
    id: string;
    numero: string;
    stato: StatoOrdine;
    creato_il: string;
    totale_cent: number;
    snapshot_societa: { nome_breve: string };
    righe: { count: number }[];
  }[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <h1 className="text-3xl text-magistra-blu">
        I miei ordini
        <span className="filetto" aria-hidden="true" />
      </h1>
      {ordini.length === 0 ? (
        <div className="panel p-6">
          <p className="text-muted">Non hai ancora inviato prenotazioni.</p>
          <Link href="/farmacia/catalogo" className="btn btn-primary mt-4">Vai al catalogo</Link>
        </div>
      ) : (
        <div className="panel p-4 sm:p-6 overflow-x-auto">
          <table className="tabella min-w-[600px]">
            <thead>
              <tr>
                <th>Numero</th>
                <th>Data</th>
                <th>Fattura</th>
                <th className="text-right">Prodotti</th>
                <th className="text-right">Totale</th>
                <th>Stato</th>
              </tr>
            </thead>
            <tbody>
              {ordini.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/farmacia/ordini/${o.id}`} className="font-semibold">{o.numero}</Link></td>
                  <td>{formattaData(o.creato_il)}</td>
                  <td>{o.snapshot_societa.nome_breve}</td>
                  <td className="text-right">{o.righe[0]?.count ?? 0}</td>
                  <td className="text-right font-semibold">{formattaEuro(o.totale_cent)}</td>
                  <td><BadgeStatoOrdine stato={o.stato} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
