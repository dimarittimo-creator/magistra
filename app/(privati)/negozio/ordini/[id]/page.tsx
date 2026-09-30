import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeStatoOrdine, DettaglioOrdine } from "@/components/ordini/DettaglioOrdine";
import { richiediPrivato } from "@/lib/auth";
import { formattaDataOra, formattaEuro } from "@/lib/formato";
import { leggiOrdine, leggiSpedizione } from "@/lib/ordini/lettura";
import { creaClientServer } from "@/lib/supabase/server";
import { formattaIban } from "@/lib/validazione";

export const metadata = { title: "Il tuo ordine" };

export default async function OrdinePrivato({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ inviato?: string }> }) {
  const { privatoId } = await richiediPrivato();
  const { id } = await params;
  const { inviato } = await searchParams;
  const db = await creaClientServer();
  const ordine = await leggiOrdine(db, id);
  if (!ordine || ordine.privato_id !== privatoId) notFound();
  const spedizione = await leggiSpedizione(db, id);
  const p = ordine.snapshot_pagamento;
  const inAttesaBonifico = p.richiede_iban && !ordine.pagamento_ricevuto_il && ["inviato", "in_verifica", "confermato", "modificato"].includes(ordine.stato);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <p><Link href="/negozio/ordini">← I miei ordini</Link></p>
      {inviato && (
        <p role="status" className="avviso avviso-ok">
          <strong>Grazie, ordine ricevuto!</strong> Ti abbiamo mandato un&apos;email con il riepilogo. Ti scriveremo quando sarà confermato e spedito.
        </p>
      )}
      {inAttesaBonifico && p.iban && (
        <section className="avviso avviso-info space-y-1">
          <p className="font-semibold">Per completare l&apos;ordine fai un bonifico di {formattaEuro(ordine.totale_cent)}</p>
          <p>IBAN {formattaIban(p.iban)} intestato a {p.intestatario}</p>
          <p>Causale: ordine {ordine.numero}. Spediamo appena riceviamo il pagamento.</p>
        </section>
      )}
      <header>
        <h1 className="text-3xl text-magistra-blu">Ordine {ordine.numero}<span className="filetto" aria-hidden="true" /></h1>
        <p className="mt-3 text-muted">Del {formattaDataOra(ordine.creato_il)} · <BadgeStatoOrdine stato={ordine.stato} /></p>
      </header>
      <DettaglioOrdine ordine={ordine} vista="privato" spedizione={spedizione} />
    </div>
  );
}
