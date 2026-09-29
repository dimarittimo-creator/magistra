"use client";

import { useMemo, useState, useTransition } from "react";
import { statoLotto, type StatoLotto } from "@/lib/availability";
import { formattaData, formattaEuro } from "@/lib/formato";
import { calcolaPrezzi, fasciaPerScadenza, scontoPerLotto, type Fascia } from "@/lib/pricing";
import { validaFasce } from "@/lib/sconti";
import { salvaSconti, type ModificheSconti } from "./azioni";

// Pannello "Sconti e prezzi farmacia" (riferimento: design/riferimento_pannello_sconti.html):
// fasce di sconto, IVA predefinita, prezzi e IVA per prodotto, sconto sul singolo lotto.
// I prezzi si ricalcolano subito con lib/pricing; "Salva modifiche" li rende validi per tutti.

export type ProdottoPannello = {
  codice: string;
  nome: string;
  prezzo_pubblico_cent: number | null;
  iva_override: number | null;
  difforme: boolean;
  lotti: { id: string; codice_lotto: string; scadenza: string | null; giacenza: number; sconto_manuale: number | null; deposito: string }[];
};

type Stato = {
  fasce: { mesi: string; sconto: string }[];
  iva: string;
  prezzi: Record<string, string>;
  ivaProdotti: Record<string, string>;
  scontiLotto: Record<string, string>;
};

const COLORI = ["bg-fascia-1", "bg-fascia-2", "bg-fascia-3", "bg-[#7b5ea7]", "bg-[#3d7fa6]", "bg-[#8a8a8a]"];

const numero = (t: string) => (t.trim() === "" ? null : Number(t.replace(",", ".")));
const euroInput = (cent: number | null) => (cent == null ? "" : (cent / 100).toFixed(2).replace(".", ","));

function statoIniziale(prodotti: ProdottoPannello[], fasce: Fascia[], iva: number): Stato {
  return {
    fasce: [...fasce].sort((a, b) => b.mesi_minimi - a.mesi_minimi).map((f) => ({ mesi: String(f.mesi_minimi), sconto: String(f.sconto_percentuale).replace(".", ",") })),
    iva: String(iva).replace(".", ","),
    prezzi: Object.fromEntries(prodotti.map((p) => [p.codice, euroInput(p.prezzo_pubblico_cent)])),
    ivaProdotti: Object.fromEntries(prodotti.map((p) => [p.codice, p.iva_override == null ? "" : String(p.iva_override).replace(".", ",")])),
    scontiLotto: Object.fromEntries(prodotti.flatMap((p) => p.lotti.map((l) => [l.id, l.sconto_manuale == null ? "" : String(l.sconto_manuale).replace(".", ",")]))),
  };
}

type Calcolo = { stato: StatoLotto; fascia: number | null; sconto: number | null; manuale: boolean; prezzi: ReturnType<typeof calcolaPrezzi> | null; iva: number };

function calcola(s: Stato, p: ProdottoPannello, l: ProdottoPannello["lotti"][number], oggi: string): Calcolo {
  const fasce: Fascia[] = s.fasce.map((f) => ({ mesi_minimi: Number(numero(f.mesi)), sconto_percentuale: Number(numero(f.sconto)) }));
  const prezzoEuro = numero(s.prezzi[p.codice] ?? "");
  const prezzo = prezzoEuro == null || Number.isNaN(prezzoEuro) ? null : Math.round(prezzoEuro * 100);
  const iva = numero(s.ivaProdotti[p.codice] ?? "") ?? Number(numero(s.iva));
  const stato = statoLotto({ deposito_id: "", scadenza: l.scadenza, giacenza: l.giacenza, disponibile: l.giacenza }, { oggi, difforme: p.difforme, conPrezzo: prezzo != null });
  if (stato !== "vendibile" && stato !== "esaurito") return { stato, fascia: null, sconto: null, manuale: false, prezzi: null, iva };
  const manuale = numero(s.scontiLotto[l.id] ?? "");
  const sc = scontoPerLotto({ scadenza: l.scadenza!, oggi, fasce, scontoManuale: manuale });
  const fascia = fasciaPerScadenza(l.scadenza!, oggi, fasce);
  return { stato, fascia: fascia?.numero ?? null, sconto: sc?.sconto ?? null, manuale: manuale != null, prezzi: sc && prezzo != null ? calcolaPrezzi(prezzo, iva, sc.sconto) : null, iva };
}

const ETICHETTE: Partial<Record<StatoLotto, { testo: string; classe: string }>> = {
  difformita: { testo: "Mancante temporaneamente", classe: "pill-bad" },
  mancante: { testo: "Senza scadenza", classe: "pill-off" },
  scaduto: { testo: "Scaduto", classe: "pill-off" },
  prezzo_mancante: { testo: "Prezzo mancante", classe: "pill-warn" },
};

export function PannelloSconti({ prodotti, fasce, iva, oggi }: { prodotti: ProdottoPannello[]; fasce: Fascia[]; iva: number; oggi: string }) {
  const [salvato, setSalvato] = useState(() => statoIniziale(prodotti, fasce, iva));
  const [s, setS] = useState(salvato);
  const [filtro, setFiltro] = useState("");
  const [esito, setEsito] = useState<{ ok?: boolean; messaggio?: string }>({});
  const [inCorso, avvia] = useTransition();

  const fasceNum = s.fasce.map((f) => ({ mesi_minimi: Number(numero(f.mesi)), sconto_percentuale: Number(numero(f.sconto)) }));
  const errori = validaFasce(fasceNum, Number(numero(s.iva)));
  const modificato = JSON.stringify(s) !== JSON.stringify(salvato);

  const { conteggi, cambiati } = useMemo(() => {
    const conteggi = { perFascia: new Map<number, number>(), manuali: 0, difformi: 0, senzaPrezzo: 0, altri: 0 };
    let cambiati = 0;
    for (const p of prodotti) {
      for (const l of p.lotti) {
        const c = calcola(s, p, l, oggi);
        if (c.prezzi) {
          if (c.manuale) conteggi.manuali++;
          else conteggi.perFascia.set(c.fascia!, (conteggi.perFascia.get(c.fascia!) ?? 0) + 1);
        } else if (c.stato === "difformita") conteggi.difformi++;
        else if (c.stato === "prezzo_mancante") conteggi.senzaPrezzo++;
        else conteggi.altri++;
        const prima = calcola(salvato, p, l, oggi);
        if (prima.stato !== c.stato || prima.prezzi?.farmaciaNettoCent !== c.prezzi?.farmaciaNettoCent) cambiati++;
      }
    }
    return { conteggi, cambiati };
  }, [s, salvato, prodotti, oggi]);

  const aggiorna = (f: (x: Stato) => Stato) => {
    setEsito({});
    setS((x) => f(structuredClone(x)));
  };

  function salva() {
    const differenze = <T,>(a: Record<string, string>, b: Record<string, string>, conv: (t: string) => T) =>
      Object.fromEntries(Object.keys(a).filter((k) => a[k] !== b[k]).map((k) => [k, conv(a[k])]));
    const modifiche: ModificheSconti = {
      fasce: fasceNum,
      iva_predefinita: Number(numero(s.iva)),
      prezzi: differenze(s.prezzi, salvato.prezzi, (t) => (numero(t) == null ? null : Math.round(Number(numero(t)) * 100))),
      iva_prodotti: differenze(s.ivaProdotti, salvato.ivaProdotti, numero),
      sconti_lotto: differenze(s.scontiLotto, salvato.scontiLotto, numero),
    };
    avvia(async () => {
      const r = await salvaSconti(modifiche);
      setEsito(r);
      if (r.ok) setSalvato(s);
    });
  }

  const q = filtro.trim().toLowerCase();
  const visibili = prodotti.filter((p) => !q || `${p.nome} ${p.codice} ${p.lotti.map((l) => l.codice_lotto).join(" ")}`.toLowerCase().includes(q));
  const ordinate = s.fasce.map((f, i) => ({ ...f, i })).sort((a, b) => Number(numero(b.mesi)) - Number(numero(a.mesi)));

  return (
    <div className="space-y-6">
      {/* Barra di salvataggio sempre visibile */}
      <div className={`sticky top-0 z-10 panel p-3 flex flex-wrap items-center justify-between gap-3 ${modificato ? "border-amber" : ""}`} role="region" aria-label="Salvataggio">
        <p role="status" className={`text-sm ${esito.ok ? "text-slate font-semibold" : esito.messaggio ? "text-danger font-semibold" : ""}`}>
          {esito.messaggio ?? (modificato ? (errori.length ? "Correggi gli errori prima di salvare." : `Modifiche non salvate: cambiano ${cambiati} lotti.`) : "Nessuna modifica in sospeso.")}
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary btn-piccolo" disabled={!modificato || inCorso} onClick={() => { setS(salvato); setEsito({}); }}>
            Annulla modifiche
          </button>
          <button type="button" className="btn btn-primary btn-piccolo" disabled={!modificato || errori.length > 0 || inCorso} onClick={salva}>
            {inCorso ? "Salvataggio…" : "Salva modifiche"}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-5" aria-labelledby="t-fasce">
          <h2 id="t-fasce" className="text-2xl text-magistra-blu mb-3">Sconti per scadenza</h2>
          <ul className="space-y-2">
            {ordinate.map((f, pos) => {
              const mesi = Number(numero(f.mesi));
              const precedente = pos > 0 ? ordinate[pos - 1].mesi : null;
              const etichetta = mesi === 0 ? (precedente ? `Sotto i ${precedente} mesi` : "Qualsiasi scadenza") : pos === 0 ? `Scadenza ad almeno ${f.mesi} mesi` : `Da ${f.mesi} a meno di ${precedente} mesi`;
              return (
                <li key={f.i} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2">
                  <span className={`size-3 rounded-full ${COLORI[pos % COLORI.length]}`} aria-hidden="true" />
                  <span className="text-sm">{etichetta}</span>
                  <label className="flex items-center gap-1 text-sm">
                    <span className="sr-only">Mesi minimi della fascia {pos + 1}</span>
                    <input value={f.mesi} inputMode="numeric" className="input w-16 text-right" onChange={(e) => aggiorna((x) => ((x.fasce[f.i].mesi = e.target.value), x))} />
                    mesi
                  </label>
                  <label className="flex items-center gap-1 text-sm">
                    <span className="sr-only">Sconto della fascia {pos + 1}</span>
                    <input value={f.sconto} inputMode="decimal" className="input w-16 text-right" onChange={(e) => aggiorna((x) => ((x.fasce[f.i].sconto = e.target.value), x))} />
                    %
                  </label>
                  <button type="button" className="btn btn-secondary btn-piccolo px-2" aria-label={`Elimina la fascia ${etichetta}`} disabled={s.fasce.length < 2}
                    onClick={() => aggiorna((x) => ((x.fasce = x.fasce.filter((_, j) => j !== f.i)), x))}>
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button type="button" className="btn btn-secondary btn-piccolo" onClick={() => aggiorna((x) => (x.fasce.push({ mesi: "", sconto: "" }), x))}>Aggiungi fascia</button>
            <label className="flex items-center gap-2 text-sm">
              IVA predefinita
              <input value={s.iva} inputMode="decimal" className="input w-16 text-right" onChange={(e) => aggiorna((x) => ((x.iva = e.target.value), x))} />%
            </label>
          </div>
          {errori.length > 0 && <div role="alert" className="avviso avviso-errore mt-3 text-sm">{errori.map((e) => <p key={e}>{e}</p>)}</div>}
          <p className="aiuto mt-3">
            Lo sconto si applica al prezzo al pubblico IVA inclusa. Per un&apos;eccezione su un singolo lotto scrivi lo sconto nella tabella; lasciando
            vuota la cella torna quello della fascia.
          </p>
        </section>

        <section className="panel p-5" aria-labelledby="t-oggi">
          <h2 id="t-oggi" className="text-2xl text-magistra-blu mb-3">Come risultano oggi i lotti</h2>
          <ul className="grid grid-cols-2 gap-3">
            {ordinate.map((f, pos) => (
              <li key={f.i} className="rounded-lg border border-line p-3 flex items-center gap-3">
                <span className={`w-1 self-stretch rounded ${COLORI[pos % COLORI.length]}`} aria-hidden="true" />
                <span><b className="text-xl">{conteggi.perFascia.get(pos + 1) ?? 0}</b> <span className="text-sm text-muted">lotti al {f.sconto}%</span></span>
              </li>
            ))}
            {conteggi.manuali > 0 && <li className="rounded-lg border border-line p-3"><b className="text-xl">{conteggi.manuali}</b> <span className="text-sm text-muted">con sconto sul lotto</span></li>}
            <li className="rounded-lg border border-line p-3"><b className="text-xl">{conteggi.difformi}</b> <span className="text-sm text-muted">mancanti per difformità</span></li>
            <li className="rounded-lg border border-line p-3"><b className="text-xl">{conteggi.senzaPrezzo}</b> <span className="text-sm text-muted">senza prezzo</span></li>
            <li className="rounded-lg border border-line p-3"><b className="text-xl">{conteggi.altri}</b> <span className="text-sm text-muted">senza scadenza o scaduti</span></li>
          </ul>
          <p className="aiuto mt-3">Fasce calcolate alla data di oggi, {formattaData(oggi)}.</p>
        </section>
      </div>

      <div>
        <label htmlFor="cerca-lotti" className="sr-only">Cerca prodotto, codice o lotto</label>
        <input id="cerca-lotti" type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Cerca prodotto, codice o lotto" className="input max-w-md" />
      </div>

      <div className="panel p-2 sm:p-4 overflow-x-auto">
        <table className="tabella min-w-[1080px] text-sm">
          <thead>
            <tr>
              <th>Prodotto</th><th>Prezzo pubblico IVA incl.</th><th>IVA %</th><th>Lotto</th><th>Scadenza</th><th className="text-right">Pezzi</th>
              <th>Sconto lotto %</th><th className="text-right">Pubblico IVA escl.</th><th className="text-right">Farmacia IVA incl.</th><th className="text-right">Farmacia IVA escl.</th><th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {visibili.flatMap((p) =>
              p.lotti.map((l, i) => {
                const c = calcola(s, p, l, oggi);
                const et = ETICHETTE[c.stato];
                return (
                  <tr key={l.id}>
                    {i === 0 && (
                      <>
                        <td rowSpan={p.lotti.length} className="align-top">
                          <span className="font-semibold">{p.nome}</span>
                          <div className="text-xs text-muted">{p.codice}</div>
                        </td>
                        <td rowSpan={p.lotti.length} className="align-top">
                          <label className="sr-only" htmlFor={`prezzo-${p.codice}`}>Prezzo al pubblico di {p.nome}</label>
                          <input id={`prezzo-${p.codice}`} value={s.prezzi[p.codice]} inputMode="decimal" placeholder="—" className="input w-24 text-right"
                            onChange={(e) => aggiorna((x) => ((x.prezzi[p.codice] = e.target.value), x))} />
                        </td>
                        <td rowSpan={p.lotti.length} className="align-top">
                          <label className="sr-only" htmlFor={`iva-${p.codice}`}>IVA di {p.nome}</label>
                          <input id={`iva-${p.codice}`} value={s.ivaProdotti[p.codice]} inputMode="decimal" placeholder={s.iva} className="input w-16 text-right"
                            onChange={(e) => aggiorna((x) => ((x.ivaProdotti[p.codice] = e.target.value), x))} />
                        </td>
                      </>
                    )}
                    <td>{l.codice_lotto}</td>
                    <td>{l.scadenza ? formattaData(l.scadenza) : "—"}</td>
                    <td className="text-right tabular-nums">{l.giacenza.toLocaleString("it-IT")}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {c.fascia && !c.manuale && <span className={`size-2.5 rounded-full ${COLORI[(c.fascia - 1) % COLORI.length]}`} aria-hidden="true" />}
                        <label className="sr-only" htmlFor={`sconto-${l.id}`}>Sconto del lotto {l.codice_lotto}</label>
                        <input id={`sconto-${l.id}`} value={s.scontiLotto[l.id]} inputMode="decimal" placeholder={c.sconto != null && !c.manuale ? String(c.sconto) : "—"}
                          className={`input w-16 text-right ${c.manuale ? "border-slate font-semibold" : ""}`}
                          onChange={(e) => aggiorna((x) => ((x.scontiLotto[l.id] = e.target.value), x))} />
                      </div>
                    </td>
                    <td className="text-right">{c.prezzi ? formattaEuro(c.prezzi.pubblicoNettoCent) : ""}</td>
                    <td className="text-right">{c.prezzi ? formattaEuro(c.prezzi.farmaciaIvatoCent) : ""}</td>
                    <td className="text-right font-bold">{c.prezzi ? formattaEuro(c.prezzi.farmaciaNettoCent) : ""}</td>
                    <td>{et ? <span className={`pill ${et.classe}`}>{et.testo}</span> : <span className="pill pill-ok">Disponibile</span>}</td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
