import Link from "next/link";
import { BadgeSconto } from "@/components/catalogo/Etichette";
import { TestoLegale } from "@/components/TestoLegale";
import { richiediFarmaciaAttiva } from "@/lib/auth";
import { leggiRigheCarrello, verificaCarrello } from "@/lib/carrello";
import { caricaCatalogo } from "@/lib/catalogo";
import { aggiungiGiorni } from "@/lib/date";
import { documentoCorrente } from "@/lib/documenti-legali";
import { formattaData, formattaEuro } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";
import { formattaIban, ibanValido } from "@/lib/validazione";
import { svuotaCarrello } from "./azioni";
import { FormInvio, QuantitaRiga } from "./ModuliCarrello";

export const metadata = { title: "Carrello" };

export default async function Carrello() {
  const utente = await richiediFarmaciaAttiva();
  const db = await creaClientServer();
  const [catalogo, salvate, condizioni, { data: societa }, { data: pagamenti }, { data: farmacia }] = await Promise.all([
    caricaCatalogo(db),
    leggiRigheCarrello(db, utente.farmaciaId),
    documentoCorrente("condizioni_farmacie"),
    db.from("societa").select("*").eq("attiva", true).eq("attiva_farmacie", true).order("predefinita", { ascending: false }),
    db.from("modalita_pagamento").select("id, descrizione, richiede_iban, contrassegno").eq("attiva", true).in("canale", ["farmacie", "entrambi"]).order("ordine"),
    db.from("farmacie").select("societa_predefinita_id").eq("id", utente.farmaciaId).single(),
  ]);
  const carrello = verificaCarrello(catalogo, salvate);
  const t = carrello.totali;

  if (carrello.righe.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl text-magistra-blu">
          Carrello
          <span className="filetto" aria-hidden="true" />
        </h1>
        <div className="panel p-6 mt-6">
          <p className="text-muted">Il carrello è vuoto.</p>
          <Link href="/farmacia/catalogo" className="btn btn-primary mt-4">Vai al catalogo</Link>
        </div>
      </div>
    );
  }

  const elencoSocieta = (societa ?? []).map((s) => ({
    id: s.id as string,
    nome_breve: s.nome_breve as string,
    ragione_sociale: s.ragione_sociale as string,
    sede: `${s.sede_legale_indirizzo} – ${s.sede_legale_cap} ${s.sede_legale_citta} (${s.sede_legale_provincia})`,
    partita_iva: s.partita_iva as string,
    iban: s.iban && ibanValido(s.iban) ? formattaIban(s.iban) : null,
    predefinita: s.predefinita as boolean,
  }));
  const predefinita =
    elencoSocieta.find((s) => s.id === farmacia?.societa_predefinita_id)?.id ?? elencoSocieta.find((s) => s.predefinita)?.id ?? elencoSocieta[0]?.id ?? "";
  const etichette = Object.fromEntries(carrello.righe.map((r) => [r.lottoId, `${r.prodotto?.nome ?? "Prodotto"} – lotto ${r.lotto?.codice_lotto ?? ""}`]));

  const riepilogo = (
    <section aria-labelledby="titolo-riepilogo" className="rounded-lg bg-grey-soft p-4">
      <h3 id="titolo-riepilogo" className="text-xl font-serif text-magistra-blu mb-3">Riepilogo</h3>
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm max-w-md ml-auto">
        <dt className="text-muted">Valore al pubblico IVA esclusa</dt>
        <dd className="text-right tabular-nums">{formattaEuro(t.imponibileCent + t.scontiCent)}</dd>
        <dt className="text-muted">Sconti</dt>
        <dd className="text-right tabular-nums">−{formattaEuro(t.scontiCent)}</dd>
        <dt className="font-semibold">Imponibile</dt>
        <dd className="text-right tabular-nums font-semibold">{formattaEuro(t.imponibileCent)}</dd>
        {t.ivaDettaglio.map((d) => (
          <FragmentIva key={d.aliquota} aliquota={d.aliquota} imponibile={d.imponibileCent} iva={d.ivaCent} />
        ))}
        <dt className="text-lg font-bold border-t border-line pt-2">Totale</dt>
        <dd className="text-lg font-bold text-right tabular-nums border-t border-line pt-2">{formattaEuro(t.totaleCent)}</dd>
      </dl>
    </section>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl text-magistra-blu">
          Carrello
          <span className="filetto" aria-hidden="true" />
        </h1>
        <form action={svuotaCarrello}>
          <button type="submit" className="btn btn-secondary btn-piccolo">Svuota il carrello</button>
        </form>
      </header>

      {carrello.problemiGenerali.map((p) => (
        <p key={p} className="avviso avviso-attenzione">{p}</p>
      ))}

      <section className="panel p-4 sm:p-6" aria-label="Prodotti nel carrello">
        <ul className="divide-y divide-line">
          {carrello.righe.map((r) => (
            <li key={r.lottoId} className="py-4 grid gap-3 md:grid-cols-[2fr_1fr_auto_auto] md:items-center">
              <div>
                <p className="font-semibold">
                  {r.prodotto ? <Link href={`/farmacia/catalogo/${r.prodotto.codice}`}>{r.prodotto.nome}</Link> : "Prodotto non più disponibile"}
                </p>
                {r.lotto && (
                  <p className="text-sm text-muted">
                    Lotto {r.lotto.codice_lotto} · scad. {r.lotto.scadenza ? formattaData(r.lotto.scadenza) : "—"} · disponibili {r.lotto.disponibile}
                  </p>
                )}
                {r.problemi.map((p) => (
                  <p key={p} className="errore-campo">{p}</p>
                ))}
              </div>
              <div className="text-sm">
                {r.lotto?.sconto && <BadgeSconto sconto={r.lotto.sconto} />}
                {r.lotto?.prezzi && (
                  <p>
                    <span className="font-bold">{formattaEuro(r.lotto.prezzi.farmaciaNettoCent)}</span>
                    <span className="text-muted"> IVA escl.</span>
                  </p>
                )}
              </div>
              <QuantitaRiga lottoId={r.lottoId} quantita={r.quantita} massimo={r.lotto?.disponibile ?? r.quantita} etichetta={etichette[r.lottoId]} />
              <p className="text-right font-semibold tabular-nums md:w-28">
                {r.lotto?.prezzi ? formattaEuro(r.lotto.prezzi.farmaciaNettoCent * r.quantita) : "—"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel p-4 sm:p-6" aria-labelledby="titolo-invio">
        <h2 id="titolo-invio" className="text-2xl text-magistra-blu mb-4">Invia la prenotazione</h2>
        {condizioni ? (
          <FormInvio
            societa={elencoSocieta}
            societaPredefinitaId={predefinita}
            pagamenti={pagamenti ?? []}
            condizioniId={condizioni.id}
            condizioniVersione={condizioni.versione}
            testoCondizioni={<TestoLegale documento={condizioni} />}
            riepilogo={riepilogo}
            consegnaGiorni={catalogo.impostazioni.giorni_consegna_indicativi}
            domani={aggiungiGiorni(catalogo.oggi, 1)}
            inviabile={carrello.inviabile}
            etichetteLotti={etichette}
            totaleTesto={formattaEuro(t.totaleCent)}
          />
        ) : (
          <p className="avviso avviso-errore">Le condizioni di vendita non sono configurate: contatta l&apos;amministrazione.</p>
        )}
      </section>
    </div>
  );
}

function FragmentIva({ aliquota, imponibile, iva }: { aliquota: number; imponibile: number; iva: number }) {
  return (
    <>
      <dt className="text-muted">
        IVA {aliquota.toLocaleString("it-IT")}% su {formattaEuro(imponibile)}
      </dt>
      <dd className="text-right tabular-nums">{formattaEuro(iva)}</dd>
    </>
  );
}
