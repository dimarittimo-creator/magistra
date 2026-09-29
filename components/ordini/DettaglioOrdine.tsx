import { formattaData, formattaDataOra, formattaEuro } from "@/lib/formato";
import { differenzeSpedizione, formattaIndirizzoSnapshot, type Ordine, type Spedizione } from "@/lib/ordini/lettura";
import { ETICHETTE_STATO_ORDINE } from "@/lib/ordini/stati";
import { formattaIban } from "@/lib/validazione";

// Dettaglio di un ordine dai dati fotografati all'invio: usato dalla farmacia e dall'amministrazione.

export function BadgeStatoOrdine({ stato }: { stato: Ordine["stato"] }) {
  const e = ETICHETTE_STATO_ORDINE[stato];
  return <span className={`pill ${e.classe}`}>{e.testo}</span>;
}

export function DettaglioOrdine({ ordine: o, vista, spedizione, azioniDdt }: { ordine: Ordine; vista: "farmacia" | "admin"; spedizione?: Spedizione | null; azioniDdt?: React.ReactNode }) {
  const s = o.snapshot_societa;
  const c = o.snapshot_cliente;
  const p = o.snapshot_pagamento;
  const inAttesa = o.stato === "inviato" || o.stato === "in_verifica";
  const differenze = spedizione ? differenzeSpedizione(o, spedizione) : [];

  return (
    <div className="space-y-6">
      {spedizione && (
        <section className="panel p-5 border-slate" aria-labelledby="t-spedizione">
          <h2 id="t-spedizione" className="text-lg font-serif text-magistra-blu mb-2">Spedizione</h2>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 text-sm">
            <p><span className="text-muted">DDT</span> <strong>n. {spedizione.ddt_numero} del {formattaData(spedizione.ddt_data)}</strong></p>
            {spedizione.corriere && <p><span className="text-muted">Corriere</span> {spedizione.corriere}</p>}
            {spedizione.tracking && <p><span className="text-muted">Tracking</span> {spedizione.tracking}</p>}
            {spedizione.colli && <p><span className="text-muted">Colli</span> {spedizione.colli}</p>}
          </div>
          {differenze.length > 0 && (
            <div className="avviso avviso-attenzione mt-3 text-sm">
              <p className="font-semibold">Differenze rispetto all&apos;ordine</p>
              <ul className="list-disc pl-5">{differenze.map((d) => <li key={d}>{d}</li>)}</ul>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {spedizione.ddt_pdf_path ? (
              <a href={`/api/ordini/${o.id}/ddt`} className="btn btn-secondary btn-piccolo">Scarica il DDT (PDF)</a>
            ) : (
              <p className="text-sm text-muted">Il PDF del DDT sarà disponibile appena caricato.</p>
            )}
            {azioniDdt}
          </div>
        </section>
      )}
      {inAttesa && o.scade_il && (
        <p className="avviso avviso-info">
          Prenotazione non vincolante in attesa di conferma. Se non viene confermata entro il <strong>{formattaDataOra(o.scade_il)}</strong> scade e
          la merce torna disponibile.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="panel p-5 text-sm space-y-1" aria-labelledby="t-societa">
          <h2 id="t-societa" className="text-lg font-serif text-magistra-blu mb-2">Fattura e consegna</h2>
          <p className="font-semibold">{s.ragione_sociale}</p>
          <p>{s.sede_legale}</p>
          <p>P.IVA {s.partita_iva}</p>
          {s.pec && <p>PEC {s.pec}</p>}
        </section>
        <section className="panel p-5 text-sm space-y-1" aria-labelledby="t-cliente">
          <h2 id="t-cliente" className="text-lg font-serif text-magistra-blu mb-2">{vista === "admin" ? "Farmacia" : "Consegna"}</h2>
          {vista === "admin" && (
            <>
              <p className="font-semibold">{c.ragione_sociale}</p>
              <p>Codice {c.codice_farmacia} · P.IVA {c.partita_iva}</p>
              <p>{c.email} · {c.telefono}</p>
            </>
          )}
          <p>Consegna: {formattaIndirizzoSnapshot(c.consegna)}</p>
          <p>Consegna indicativa entro {o.consegna_indicativa_giorni} giorni lavorativi dalla conferma</p>
          {o.data_consegna_desiderata && <p>Data desiderata: {formattaData(o.data_consegna_desiderata)}</p>}
          {o.note && <p>Note: {o.note}</p>}
        </section>
        <section className="panel p-5 text-sm space-y-1" aria-labelledby="t-pagamento">
          <h2 id="t-pagamento" className="text-lg font-serif text-magistra-blu mb-2">Pagamento</h2>
          <p className="font-semibold">{p.descrizione}</p>
          {p.richiede_iban && p.iban && (
            <>
              <p>IBAN {formattaIban(p.iban)}</p>
              <p>Intestato a {p.intestatario}</p>
              <p>Causale: ordine {o.numero}</p>
            </>
          )}
          {p.contrassegno && <p>Da pagare alla consegna: <strong>{formattaEuro(o.totale_cent)}</strong></p>}
          <p className="text-muted">Condizioni di vendita accettate: versione {o.condizioni_versione}</p>
        </section>
      </div>

      <section className="panel p-4 sm:p-6 overflow-x-auto" aria-labelledby="t-righe">
        <h2 id="t-righe" className="text-lg font-serif text-magistra-blu mb-3">Prodotti</h2>
        <table className="tabella min-w-[720px]">
          <thead>
            <tr>
              <th>Prodotto</th>
              <th>Lotto</th>
              <th>Scadenza</th>
              <th className="text-right">Q.tà</th>
              <th className="text-right">Pubblico IVA incl.</th>
              <th className="text-right">Sconto</th>
              <th className="text-right">Prezzo IVA escl.</th>
              <th className="text-right">Imponibile</th>
            </tr>
          </thead>
          <tbody>
            {o.righe.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.prodotto_nome}
                  <div className="text-xs text-muted">Minsan {r.prodotto_codice}</div>
                </td>
                <td>{r.codice_lotto}</td>
                <td>{formattaData(r.scadenza)}</td>
                <td className="text-right tabular-nums">{r.quantita}</td>
                <td className="text-right">{formattaEuro(r.prezzo_pubblico_cent)}</td>
                <td className="text-right">−{r.sconto_applicato.toLocaleString("it-IT")}%</td>
                <td className="text-right font-semibold">{formattaEuro(r.prezzo_farmacia_netto_cent)}</td>
                <td className="text-right">{formattaEuro(r.imponibile_cent)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7} className="text-right font-semibold">Imponibile</td>
              <td className="text-right font-semibold">{formattaEuro(o.imponibile_cent)}</td>
            </tr>
            {o.iva_dettaglio.map((d) => (
              <tr key={d.aliquota}>
                <td colSpan={7} className="text-right text-muted">IVA {d.aliquota.toLocaleString("it-IT")}% su {formattaEuro(d.imponibileCent)}</td>
                <td className="text-right">{formattaEuro(d.ivaCent)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={7} className="text-right text-lg font-bold">Totale</td>
              <td className="text-right text-lg font-bold">{formattaEuro(o.totale_cent)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="panel p-5" aria-labelledby="t-storico">
        <h2 id="t-storico" className="text-lg font-serif text-magistra-blu mb-3">Stato</h2>
        <ol className="space-y-3">
          {o.storico.map((st) => (
            <li key={st.id} className="border-l-2 border-magistra-rame pl-4">
              <p className="text-sm text-muted">{formattaDataOra(st.il)}</p>
              <p>
                <BadgeStatoOrdine stato={st.a} /> {st.messaggio}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
