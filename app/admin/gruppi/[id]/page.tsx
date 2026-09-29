import Link from "next/link";
import { notFound } from "next/navigation";
import { richiediAdmin } from "@/lib/auth";
import { creaClientServer } from "@/lib/supabase/server";
import { ListinoGruppo } from "./ListinoGruppo";

export const metadata = { title: "Listino del gruppo" };

export default async function PaginaGruppo({ params }: { params: Promise<{ id: string }> }) {
  await richiediAdmin();
  const { id } = await params;
  const db = await creaClientServer();
  const [{ data: gruppo }, { data: prodotti }, { data: listino }, { data: farmacie }] = await Promise.all([
    db.from("gruppi").select("id, nome, descrizione").eq("id", id).maybeSingle(),
    db.from("prodotti").select("codice, nome, prezzo_pubblico_cent").eq("attivo", true).not("prezzo_pubblico_cent", "is", null).order("nome"),
    db.from("listini_gruppo").select("prodotto_codice, prezzo_pubblico_cent, sconto_percentuale").eq("gruppo_id", id),
    db.from("farmacie").select("id, ragione_sociale").eq("gruppo_id", id).order("ragione_sociale"),
  ]);
  if (!gruppo) notFound();
  const perProdotto = new Map((listino ?? []).map((l) => [l.prodotto_codice, l]));

  return (
    <div className="space-y-6">
      <p><Link href="/admin/gruppi">← Gruppi</Link></p>
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Listino dedicato: {gruppo.nome}
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted max-w-3xl">
          Per ogni prodotto puoi indicare un prezzo al pubblico diverso per questo gruppo (su cui si calcolano gli sconti) e/o uno sconto riservato:
          se è migliore di quello del lotto, vale lo sconto riservato (non si sommano). Lascia vuoto per le condizioni normali.
        </p>
        <p className="mt-2 text-sm">
          Farmacie nel gruppo: {farmacie?.length ? farmacie.map((f) => f.ragione_sociale).join(", ") : "nessuna (assegnale dalla scheda farmacia)"}
        </p>
      </header>
      <section className="panel p-4 sm:p-6 overflow-x-auto">
        <ListinoGruppo
          gruppoId={gruppo.id}
          righe={(prodotti ?? []).map((p) => {
            const l = perProdotto.get(p.codice);
            return {
              codice: p.codice,
              nome: p.nome,
              prezzo_pubblico_cent: p.prezzo_pubblico_cent!,
              prezzo: l?.prezzo_pubblico_cent == null ? "" : (l.prezzo_pubblico_cent / 100).toFixed(2).replace(".", ","),
              sconto: l?.sconto_percentuale == null ? "" : String(l.sconto_percentuale).replace(".", ","),
            };
          })}
        />
      </section>
    </div>
  );
}
