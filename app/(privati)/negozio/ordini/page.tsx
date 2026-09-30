import Link from "next/link";
import { BadgeStatoOrdine } from "@/components/ordini/DettaglioOrdine";
import { richiediPrivato } from "@/lib/auth";
import { formattaData, formattaEuro } from "@/lib/formato";
import type { StatoOrdine } from "@/lib/ordini/stati";
import { creaClientServer } from "@/lib/supabase/server";

export const metadata = { title: "I miei ordini" };

export default async function OrdiniPrivato() {
  const { privatoId } = await richiediPrivato();
  const db = await creaClientServer();
  const { data } = await db.from("ordini").select("id, numero, stato, creato_il, totale_cent").eq("privato_id", privatoId).order("creato_il", { ascending: false });
  const ordini = (data ?? []) as { id: string; numero: string; stato: StatoOrdine; creato_il: string; totale_cent: number }[];
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <h1 className="text-3xl text-magistra-blu">I miei ordini<span className="filetto" aria-hidden="true" /></h1>
      {ordini.length === 0 ? (
        <div className="panel p-6">
          <p className="text-muted">Non hai ancora fatto ordini.</p>
          <Link href="/negozio" className="btn btn-primary mt-4">Vai al negozio</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {ordini.map((o) => (
            <li key={o.id}>
              <Link href={`/negozio/ordini/${o.id}`} className="panel p-4 flex flex-wrap items-center justify-between gap-3 no-underline text-ink hover:border-brand">
                <span>
                  <span className="font-semibold">Ordine {o.numero}</span>
                  <span className="block text-sm text-muted">del {formattaData(o.creato_il)}</span>
                </span>
                <span className="flex items-center gap-3">
                  <BadgeStatoOrdine stato={o.stato} />
                  <span className="font-semibold tabular-nums">{formattaEuro(o.totale_cent)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
