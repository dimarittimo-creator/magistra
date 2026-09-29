import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeStatoOrdine, DettaglioOrdine } from "@/components/ordini/DettaglioOrdine";
import { richiediStaff } from "@/lib/auth";
import { formattaDataOra } from "@/lib/formato";
import { leggiOrdine } from "@/lib/ordini/lettura";
import { creaClientServer } from "@/lib/supabase/server";

export const metadata = { title: "Ordine" };

export default async function OrdineAdmin({ params }: { params: Promise<{ id: string }> }) {
  await richiediStaff();
  const { id } = await params;
  const db = await creaClientServer();
  const ordine = await leggiOrdine(db, id);
  if (!ordine) notFound();

  return (
    <div className="space-y-6">
      <p>
        <Link href="/admin/ordini">← Tutti gli ordini</Link>
      </p>
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Ordine {ordine.numero}
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-3 text-muted">
          {ordine.snapshot_cliente.ragione_sociale} · inviato il {formattaDataOra(ordine.creato_il)} · <BadgeStatoOrdine stato={ordine.stato} />
        </p>
      </header>
      {ordine.farmacia_id && (
        <p>
          <Link href={`/admin/farmacie/${ordine.farmacia_id}`}>Scheda della farmacia</Link>
        </p>
      )}
      <DettaglioOrdine ordine={ordine} vista="admin" />
    </div>
  );
}
