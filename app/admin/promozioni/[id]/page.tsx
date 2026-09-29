import Link from "next/link";
import { notFound } from "next/navigation";
import { StoricoModifiche } from "@/components/admin/StoricoModifiche";
import { richiediAdmin } from "@/lib/auth";
import { aggiungiGiorni, oggiRoma } from "@/lib/date";
import { formattaData } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";
import { duplicaPromozione } from "../azioni";
import { FormPromozione } from "../FormPromozione";

export const metadata = { title: "Promozione" };

export default async function PaginaPromozione({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copia?: string; salvata?: string }> }) {
  await richiediAdmin();
  const { id } = await params;
  const avviso = await searchParams;
  const nuova = id === "nuova";
  const db = await creaClientServer();
  const [{ data: p }, { data: prodotti }, { data: linee }, { data: lotti }, { data: gruppi }] = await Promise.all([
    nuova ? Promise.resolve({ data: null }) : db.from("promozioni").select("*").eq("id", id).maybeSingle(),
    db.from("prodotti").select("codice, nome").eq("attivo", true).not("prezzo_pubblico_cent", "is", null).order("nome"),
    db.from("linee").select("id, nome").order("nome"),
    db.from("lotti").select("id, codice_lotto, scadenza, prodotto:prodotto_codice(nome)").gt("giacenza", 0).order("prodotto_codice"),
    db.from("gruppi").select("id, nome").eq("attivo", true).order("nome"),
  ]);
  if (!nuova && !p) notFound();

  const oggi = oggiRoma();
  const iniziali: Record<string, string> = p
    ? Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v == null ? "" : typeof v === "boolean" ? (v ? "on" : "") : String(v)]))
    : { tipo: "sconto_percentuale", ambito: "prodotto", inizio: oggi, fine: aggiungiGiorni(oggi, 30) };

  return (
    <div className="space-y-6">
      <p><Link href="/admin/promozioni">← Promozioni</Link></p>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-3xl text-magistra-blu">
          {p ? p.nome : "Nuova promozione"}
          <span className="filetto" aria-hidden="true" />
        </h1>
        {p && (
          <form action={duplicaPromozione.bind(null, p.id)}>
            <button type="submit" className="btn btn-secondary">Duplica</button>
          </form>
        )}
      </header>
      {avviso.copia && <p role="status" className="avviso avviso-attenzione">Questa è una copia ed è sospesa: sistema nome e date, poi togli «Sospesa».</p>}
      {avviso.salvata && <p role="status" className="avviso avviso-ok">Promozione creata.</p>}
      <section className="panel p-6">
        <FormPromozione
          id={p?.id ?? null}
          iniziali={iniziali}
          prodotti={(prodotti ?? []).map((x) => ({ id: x.codice, nome: x.nome }))}
          linee={linee ?? []}
          lotti={(lotti ?? []).map((l) => ({ id: l.id, nome: `${(l.prodotto as unknown as { nome: string }).nome} – lotto ${l.codice_lotto}${l.scadenza ? ` (scad. ${formattaData(l.scadenza)})` : ""}` }))}
          gruppi={gruppi ?? []}
        />
      </section>
      {p && <StoricoModifiche tabella="promozioni" recordId={p.id} etichette={{ nome: "Nome", tipo: "Tipo", sconto_percentuale: "Sconto %", compra: "Ogni", omaggio_quantita: "Omaggio", inizio: "Dal", fine: "Al", sospesa: "Sospesa", ambito: "Ambito", gruppo_id: "Gruppo" }} valoriLeggibili={{ gruppo_id: Object.fromEntries((gruppi ?? []).map((g) => [g.id, g.nome])) }} />}
    </div>
  );
}
