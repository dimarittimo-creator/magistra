import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeStatoOrdine, DettaglioOrdine } from "@/components/ordini/DettaglioOrdine";
import { richiediStaff } from "@/lib/auth";
import { formattaDataOra } from "@/lib/formato";
import { leggiOrdine, leggiSpedizione } from "@/lib/ordini/lettura";
import { creaClientServer } from "@/lib/supabase/server";
import { AzioniOrdine, CaricaPdfDdt } from "./AzioniOrdine";

export const metadata = { title: "Ordine" };

export default async function OrdineAdmin({ params }: { params: Promise<{ id: string }> }) {
  await richiediStaff();
  const { id } = await params;
  const db = await creaClientServer();
  const ordine = await leggiOrdine(db, id);
  if (!ordine) notFound();

  const [spedizione, { data: societa }, { data: pagamenti }, { data: imp }, { data: lotti }] = await Promise.all([
    leggiSpedizione(db, id),
    db.from("societa").select("id, nome_breve").eq("attiva", true).order("predefinita", { ascending: false }),
    db.from("modalita_pagamento").select("id, descrizione").eq("attiva", true).in("canale", ["farmacie", "entrambi"]).order("ordine"),
    db.from("impostazioni").select("modalita_invio_deposito, orario_invio_cumulativo").single(),
    db.from("lotti").select("prodotto_codice, codice_lotto").eq("deposito_id", ordine.deposito_id).in("prodotto_codice", ordine.righe.map((r) => r.prodotto_codice)),
  ]);
  const lottiPerProdotto: Record<string, string[]> = {};
  for (const l of lotti ?? []) (lottiPerProdotto[l.prodotto_codice] ??= []).push(l.codice_lotto);
  const { data: pagamentoAttuale } = await db.from("ordini").select("modalita_pagamento_id").eq("id", id).single();

  return (
    <div className="space-y-6">
      <p><Link href="/admin/ordini">← Tutti gli ordini</Link></p>
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Ordine {ordine.numero}
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-3 text-muted">
          {ordine.snapshot_cliente.ragione_sociale} · inviato il {formattaDataOra(ordine.creato_il)} · <BadgeStatoOrdine stato={ordine.stato} />
        </p>
        {ordine.farmacia_id && <p className="mt-2"><Link href={`/admin/farmacie/${ordine.farmacia_id}`}>Scheda della farmacia</Link></p>}
      </header>

      {!["rifiutato", "scaduto", "consegnato"].includes(ordine.stato) && (
        <section className="panel p-6" aria-labelledby="t-azioni">
          <h2 id="t-azioni" className="text-2xl text-magistra-blu mb-4">Cosa fare</h2>
          <AzioniOrdine
            id={ordine.id}
            stato={ordine.stato}
            righe={ordine.righe}
            societa={(societa ?? []).map((s) => ({ id: s.id, nome: s.nome_breve }))}
            pagamenti={(pagamenti ?? []).map((p) => ({ id: p.id, nome: p.descrizione }))}
            societaId={ordine.societa_id}
            pagamentoId={pagamentoAttuale?.modalita_pagamento_id ?? ""}
            lottiPerProdotto={lottiPerProdotto}
            cumulativa={imp?.modalita_invio_deposito === "cumulativa"}
            orario={String(imp?.orario_invio_cumulativo ?? "12:00").slice(0, 5)}
            attesaBonifico={ordine.canale === "privati" && ordine.snapshot_pagamento.richiede_iban && !ordine.pagamento_ricevuto_il}
            modificheDaAccettare={ordine.modifiche_da_accettare}
          />
        </section>
      )}

      <DettaglioOrdine ordine={ordine} vista="admin" spedizione={spedizione} azioniDdt={spedizione ? <CaricaPdfDdt ordineId={ordine.id} /> : null} />
    </div>
  );
}
