import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeSconto, BadgeStatoProdotto } from "@/components/catalogo/Etichette";
import { OfferteInCorso } from "@/components/catalogo/OfferteInCorso";
import { richiediFarmaciaAttiva } from "@/lib/auth";
import { caricaCatalogo } from "@/lib/catalogo";
import { formattaData, formattaEuro } from "@/lib/formato";
import { descriviOmaggioExtra, descriviPromozione } from "@/lib/promozioni";
import { creaClientServer } from "@/lib/supabase/server";
import { AggiungiLotto } from "./AggiungiLotto";

export const metadata = { title: "Prodotto" };

const STATI_LOTTO: Record<string, string> = {
  difformita: "Mancante temporaneamente",
  mancante: "Mancante (scadenza non comunicata)",
  esaurito: "Esaurito",
};

export default async function SchedaProdotto({ params }: { params: Promise<{ codice: string }> }) {
  const { farmaciaId } = await richiediFarmaciaAttiva();
  const { codice } = await params;
  if (!/^\d{9}$/.test(codice)) notFound();
  const db = await creaClientServer();
  const catalogo = await caricaCatalogo(db, { codice, farmaciaId });
  const p = catalogo.prodotti[0];
  if (!p) notFound();

  const ivaTesto = `${p.iva.toLocaleString("it-IT")}%`;
  const extra = [...new Map(p.lotti.flatMap((l) => l.promoExtra.map((x) => [x.id, x]))).values()];
  const promo = [...new Map(p.lotti.flatMap((l) => l.promoMerce.map((m) => [m.id, { ...m, lotti: p.lotti.filter((x) => x.promoMerce.some((y) => y.id === m.id)).length }]))).values()];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <p>
        <Link href="/farmacia/catalogo">← Catalogo</Link>
      </p>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl text-magistra-blu">
            {p.nome}
            <span className="filetto" aria-hidden="true" />
          </h1>
          <p className="mt-3 text-muted">
            Minsan {p.codice}
            {p.formato && ` · ${p.formato}`}
            {p.linea && ` · Linea ${p.linea.nome}`}
            {p.area && ` · ${p.area.nome}`}
          </p>
        </div>
        <BadgeStatoProdotto stato={p.stato} />
      </header>

      <section className="panel p-5 grid gap-4 sm:grid-cols-4 text-sm" aria-label="Prezzo di listino">
        <div>
          <p className="text-muted">Prezzo al pubblico IVA inclusa</p>
          <p className="text-lg font-semibold">{formattaEuro(p.prezzo_pubblico_cent!)}</p>
        </div>
        <div>
          <p className="text-muted">IVA</p>
          <p className="text-lg font-semibold">{ivaTesto}</p>
        </div>
        <div>
          <p className="text-muted">Disponibili</p>
          <p className="text-lg font-semibold">{p.disponibile.toLocaleString("it-IT")} pz</p>
        </div>
        <div>
          <p className="text-muted">Ordine minimo</p>
          <p className="text-lg font-semibold">
            {p.minimo_ordine} pz{p.multiplo > 1 && ` (multipli di ${p.multiplo})`}
          </p>
        </div>
        {p.descrizione && <p className="sm:col-span-4">{p.descrizione}</p>}
      </section>

      {(promo.length > 0 || extra.length > 0) && (
        <section className="avviso avviso-ok" aria-label="Promozioni in corso">
          {promo.map((m) => (
            <p key={m.id}>
              <span className="pill pill-ok mr-2">Promozione</span>
              <strong>{m.nome}</strong>: {descriviPromozione(m)}
              {m.lotti < p.lotti.length && " (solo su alcuni lotti)"}.
            </p>
          ))}
          {extra.map((x) => (
            <p key={`extra-${x.id}`}>
              <span className="pill pill-ok mr-2">Omaggio</span>
              <strong>{x.nome}</strong>: {descriviOmaggioExtra(x)} (anche sommando lotti diversi).
            </p>
          ))}
        </section>
      )}
      <OfferteInCorso offerte={catalogo.offerte} titolo="Volantino dell'offerta" collegaProdotto={false} />
      {p.prezzoDiGruppo && <p className="avviso avviso-info">Prezzo al pubblico del listino riservato al tuo gruppo.</p>}

      {p.stato === "mancante_temporaneamente" && (
        <p className="avviso avviso-errore">
          Prodotto momentaneamente non ordinabile: stiamo verificando le quantità con il deposito.
        </p>
      )}

      <section className="panel p-4 sm:p-6" aria-labelledby="titolo-lotti">
        <h2 id="titolo-lotti" className="text-2xl text-magistra-blu">Lotti</h2>
        {p.lotti.length === 0 ? (
          <p className="mt-3 text-muted">Nessun lotto disponibile in questo momento.</p>
        ) : (
          <>
            {/* Tablet e computer: tabella */}
            <div className="mt-4 overflow-x-auto hidden md:block">
              <table className="tabella">
                <thead>
                  <tr>
                    <th>Lotto</th>
                    <th>Scadenza</th>
                    <th className="text-right">Disponibili</th>
                    <th>Sconto sul<br />pubblico</th>
                    <th className="text-right">Pubblico<br />IVA incl.</th>
                    <th className="text-right">Pubblico<br />IVA escl.</th>
                    <th className="text-right">Farmacia<br />IVA incl.</th>
                    <th className="text-right">Prezzo farmacia<br />+ IVA</th>
                    <th>Quantità</th>
                  </tr>
                </thead>
                <tbody>
                  {p.lotti.map((l) => (
                    <tr key={l.id}>
                      <td className="font-semibold">{l.codice_lotto}</td>
                      <td>
                        {l.scadenza ? formattaData(l.scadenza) : "—"}
                        {l.durataRidotta && <span className="block text-xs text-amber font-semibold">sotto i {catalogo.impostazioni.mesi_durata_residua_garantita} mesi</span>}
                      </td>
                      <td className="text-right tabular-nums">{l.disponibile.toLocaleString("it-IT")}</td>
                      <td>{l.sconto ? <BadgeSconto sconto={l.sconto} /> : "—"}</td>
                      <td className="text-right">{l.prezzi ? formattaEuro(l.prezzi.pubblicoIvatoCent) : "—"}</td>
                      <td className="text-right">{l.prezzi ? formattaEuro(l.prezzi.pubblicoNettoCent) : "—"}</td>
                      <td className="text-right">{l.prezzi ? formattaEuro(l.prezzi.farmaciaIvatoCent) : "—"}</td>
                      <td className="text-right font-bold text-base">{l.prezzi ? formattaEuro(l.prezzi.farmaciaNettoCent) : "—"}</td>
                      <td>
                        {l.stato === "vendibile" ? (
                          <AggiungiLotto lottoId={l.id} codiceLotto={l.codice_lotto} massimo={l.disponibile} minimo={p.minimo_ordine} variante="tabella" />
                        ) : (
                          <span className="pill pill-bad">{STATI_LOTTO[l.stato] ?? "Non disponibile"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Smartphone: una scheda per lotto */}
            <ul className="mt-4 space-y-3 md:hidden">
              {p.lotti.map((l) => (
                <li key={l.id} className="rounded-lg border border-line p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">Lotto {l.codice_lotto}</p>
                      <p className="text-sm text-muted">
                        Scadenza {l.scadenza ? formattaData(l.scadenza) : "—"} · {l.disponibile.toLocaleString("it-IT")} pz
                      </p>
                      {l.durataRidotta && <span className="block text-xs text-amber font-semibold">sotto i {catalogo.impostazioni.mesi_durata_residua_garantita} mesi</span>}
                    </div>
                    {l.sconto && <BadgeSconto sconto={l.sconto} />}
                  </div>
                  {l.prezzi && (
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted">Pubblico IVA incl.</dt><dd className="text-right">{formattaEuro(l.prezzi.pubblicoIvatoCent)}</dd>
                      <dt className="text-muted">Pubblico IVA escl.</dt><dd className="text-right">{formattaEuro(l.prezzi.pubblicoNettoCent)}</dd>
                      <dt className="text-muted">Farmacia IVA incl.</dt><dd className="text-right">{formattaEuro(l.prezzi.farmaciaIvatoCent)}</dd>
                      <dt className="font-semibold">Prezzo farmacia + IVA</dt><dd className="text-right font-bold text-base">{formattaEuro(l.prezzi.farmaciaNettoCent)}</dd>
                    </dl>
                  )}
                  {l.stato === "vendibile" ? (
                    <AggiungiLotto lottoId={l.id} codiceLotto={l.codice_lotto} massimo={l.disponibile} minimo={p.minimo_ordine} variante="elenco" />
                  ) : (
                    <span className="pill pill-bad">{STATI_LOTTO[l.stato] ?? "Non disponibile"}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
