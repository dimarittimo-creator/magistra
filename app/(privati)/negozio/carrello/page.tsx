import Link from "next/link";
import { TestoLegale } from "@/components/TestoLegale";
import { richiediPrivato } from "@/lib/auth";
import { documentoCorrente } from "@/lib/documenti-legali";
import { formattaEuro } from "@/lib/formato";
import { caricaNegozio } from "@/lib/negozio";
import { leggiCarrelloPrivato, leggiRegolaSpese, verificaCarrelloPrivato } from "@/lib/privati/carrello";
import { creaClientServer } from "@/lib/supabase/server";
import { ibanValido } from "@/lib/validazione";
import { FormOrdinePrivato, QuantitaProdotto } from "./ModuliCarrelloPrivato";

export const metadata = { title: "Carrello" };

export default async function CarrelloPrivato() {
  const { privatoId } = await richiediPrivato();
  const db = await creaClientServer();
  const [negozio, salvate, spese, condizioni, { data: societa }, { data: pagamenti }] = await Promise.all([
    caricaNegozio(),
    leggiCarrelloPrivato(db, privatoId),
    leggiRegolaSpese(db),
    documentoCorrente("condizioni_privati"),
    db.from("societa").select("id, nome_breve, ragione_sociale, iban, predefinita").eq("attiva", true).eq("attiva_privati", true).order("predefinita", { ascending: false }),
    db.from("modalita_pagamento").select("id, descrizione, richiede_iban, contrassegno, costo_aggiuntivo_cent").eq("attiva", true).in("canale", ["privati", "entrambi"]).order("ordine"),
  ]);
  const carrello = verificaCarrelloPrivato(negozio, salvate, spese);

  if (!carrello.righe.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl text-magistra-blu">Il tuo carrello<span className="filetto" aria-hidden="true" /></h1>
        <div className="panel p-6 mt-6">
          <p className="text-muted">Il carrello è vuoto.</p>
          <Link href="/negozio" className="btn btn-primary mt-4">Vai al negozio</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <h1 className="text-3xl text-magistra-blu">Il tuo carrello<span className="filetto" aria-hidden="true" /></h1>
      {carrello.problemiGenerali.map((x) => <p key={x} className="avviso avviso-attenzione">{x}</p>)}

      <section className="panel p-4 sm:p-6" aria-label="Prodotti nel carrello">
        <ul className="divide-y divide-line">
          {carrello.righe.map((r) => (
            <li key={r.codice} className="py-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div>
                <p className="font-semibold">{r.prodotto ? <Link href={`/negozio/${r.codice}`}>{r.prodotto.nome}</Link> : "Prodotto non più in vendita"}</p>
                {r.prodotto && (
                  <p className="text-sm text-muted">
                    {r.prodotto.prezzo.scontoPercentuale > 0 && <><s>{formattaEuro(r.prodotto.prezzo.pienoCent)}</s>{" "}</>}
                    {formattaEuro(r.prodotto.prezzo.ivatoCent)} cad.
                    {r.prodotto.prezzo.scontoPercentuale > 0 && <span className="text-danger font-semibold"> −{r.prodotto.prezzo.scontoPercentuale.toLocaleString("it-IT")}% questo mese</span>}
                  </p>
                )}
                {r.problema && <p className="errore-campo">{r.problema}</p>}
              </div>
              <QuantitaProdotto codice={r.codice} quantita={r.quantita} nome={r.prodotto?.nome ?? r.codice} />
              <p className="text-right font-semibold tabular-nums sm:w-24">{r.prodotto ? formattaEuro(r.prodotto.prezzo.ivatoCent * r.quantita) : "—"}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel p-4 sm:p-6" aria-labelledby="t-ordine">
        <h2 id="t-ordine" className="text-2xl text-magistra-blu mb-1">Completa l&apos;ordine</h2>
        <p className="text-sm text-muted mb-4">Chi vende e spedisce: <Link href="/chi-siamo" target="_blank">dati del venditore</Link>.</p>
        {condizioni ? (
          <FormOrdinePrivato
            societa={(societa ?? []).map((s) => ({ id: s.id, nome_breve: s.nome_breve, ragione_sociale: s.ragione_sociale, iban: s.iban && ibanValido(s.iban) ? s.iban : null }))}
            pagamenti={pagamenti ?? []}
            condizioniId={condizioni.id}
            condizioniVersione={condizioni.versione}
            testoCondizioni={<TestoLegale documento={condizioni} />}
            prodottiCent={carrello.totali.prodottiCent}
            speseCent={carrello.speseCent}
            totaleCent={carrello.totali.totaleCent}
            consegnaGiorni={negozio.giorniConsegna}
            inviabile={carrello.inviabile}
          />
        ) : (
          <p className="avviso avviso-errore">Condizioni di vendita non disponibili: riprova più tardi.</p>
        )}
      </section>
    </div>
  );
}
