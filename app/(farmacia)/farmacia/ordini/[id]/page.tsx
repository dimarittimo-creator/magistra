import Link from "next/link";
import { notFound } from "next/navigation";
import { AccettaModifiche } from "@/components/ordini/AccettaModifiche";
import { BadgeStatoOrdine, DettaglioOrdine } from "@/components/ordini/DettaglioOrdine";
import { richiediFarmaciaAttiva } from "@/lib/auth";
import { formattaDataOra } from "@/lib/formato";
import { leggiOrdine, leggiSpedizione, notaModifica } from "@/lib/ordini/lettura";
import { creaClientServer } from "@/lib/supabase/server";
import { rispondiModificheFarmacia } from "../azioni";
import { RipetiOrdine } from "./RipetiOrdine";

export const metadata = { title: "Ordine" };

export default async function PaginaOrdine({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ inviato?: string }> }) {
  const { farmaciaId } = await richiediFarmaciaAttiva();
  const { id } = await params;
  const { inviato } = await searchParams;
  const db = await creaClientServer();
  const ordine = await leggiOrdine(db, id);
  if (!ordine || ordine.farmacia_id !== farmaciaId) notFound();
  const spedizione = await leggiSpedizione(db, id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <p>
        <Link href="/farmacia/ordini">← I miei ordini</Link>
      </p>
      {inviato && (
        <p role="status" className="avviso avviso-ok">
          <strong>Prenotazione inviata.</strong> Ti abbiamo mandato un&apos;email con il riepilogo; riceverai un&apos;altra email quando
          l&apos;ordine sarà confermato.
        </p>
      )}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl text-magistra-blu">
            Ordine {ordine.numero}
            <span className="filetto" aria-hidden="true" />
          </h1>
          <p className="mt-3 text-muted">
            Inviato il {formattaDataOra(ordine.creato_il)} · <BadgeStatoOrdine stato={ordine.stato} />
          </p>
        </div>
        <RipetiOrdine ordineId={ordine.id} />
      </header>
      {ordine.modifiche_da_accettare && (
        <AccettaModifiche
          accetta={rispondiModificheFarmacia.bind(null, ordine.id, true)}
          rifiuta={rispondiModificheFarmacia.bind(null, ordine.id, false)}
          nota={notaModifica(ordine)}
          scadenza={ordine.scade_il ? formattaDataOra(ordine.scade_il) : null}
        />
      )}
      {ordine.modifiche_accettate_il && (
        <p className="avviso avviso-ok">Hai accettato le modifiche a questo ordine il {formattaDataOra(ordine.modifiche_accettate_il)}.</p>
      )}
      <DettaglioOrdine ordine={ordine} vista="farmacia" spedizione={spedizione} />
    </div>
  );
}
