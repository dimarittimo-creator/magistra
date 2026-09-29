"use client";

import { useState, useTransition } from "react";
import { EsitoModulo } from "@/components/moduli";
import { formattaEuro } from "@/lib/formato";
import { salvaListino, type VoceListino } from "./azioni";

type Riga = { codice: string; nome: string; prezzo_pubblico_cent: number; prezzo: string; sconto: string };

export function ListinoGruppo({ gruppoId, righe }: { gruppoId: string; righe: Riga[] }) {
  const [valori, setValori] = useState(() => Object.fromEntries(righe.map((r) => [r.codice, { prezzo: r.prezzo, sconto: r.sconto }])));
  const [salvati, setSalvati] = useState(valori);
  const [esito, setEsito] = useState<{ ok?: boolean; messaggio?: string; righe?: Record<string, string> }>({});
  const [filtro, setFiltro] = useState("");
  const [inCorso, avvia] = useTransition();
  const modificati = righe.filter((r) => JSON.stringify(valori[r.codice]) !== JSON.stringify(salvati[r.codice]));

  function salva() {
    const voci: VoceListino[] = modificati.map((r) => ({ codice: r.codice, ...valori[r.codice] }));
    avvia(async () => {
      const r = await salvaListino(gruppoId, voci);
      setEsito(r);
      if (r.ok) setSalvati(valori);
    });
  }

  const q = filtro.toLowerCase();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2">
          <span className="sr-only">Cerca prodotto</span>
          <input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Cerca prodotto" className="input w-64" />
        </label>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted" role="status">{modificati.length ? `${modificati.length} modifiche da salvare` : ""}</span>
          <button type="button" className="btn btn-primary btn-piccolo" disabled={!modificati.length || inCorso} onClick={salva}>
            {inCorso ? "Salvataggio…" : "Salva il listino"}
          </button>
        </div>
      </div>
      <EsitoModulo ok={esito.ok} messaggio={esito.messaggio} />
      <table className="tabella text-sm min-w-[640px]">
        <thead><tr><th>Prodotto</th><th className="text-right">Prezzo di listino</th><th>Prezzo al pubblico per il gruppo (€)</th><th>Sconto riservato %</th></tr></thead>
        <tbody>
          {righe.filter((r) => !q || `${r.nome} ${r.codice}`.toLowerCase().includes(q)).map((r) => (
            <tr key={r.codice}>
              <td>{r.nome}<div className="text-xs text-muted">{r.codice}</div></td>
              <td className="text-right">{formattaEuro(r.prezzo_pubblico_cent)}</td>
              <td>
                <label className="sr-only" htmlFor={`lp-${r.codice}`}>Prezzo per il gruppo di {r.nome}</label>
                <input id={`lp-${r.codice}`} value={valori[r.codice].prezzo} placeholder="come listino" inputMode="decimal" className="input w-28 text-right"
                  onChange={(e) => setValori((v) => ({ ...v, [r.codice]: { ...v[r.codice], prezzo: e.target.value } }))} />
              </td>
              <td>
                <label className="sr-only" htmlFor={`ls-${r.codice}`}>Sconto riservato di {r.nome}</label>
                <input id={`ls-${r.codice}`} value={valori[r.codice].sconto} placeholder="—" inputMode="decimal" className="input w-20 text-right"
                  onChange={(e) => setValori((v) => ({ ...v, [r.codice]: { ...v[r.codice], sconto: e.target.value } }))} />
                {esito.righe?.[r.codice] && <p className="errore-campo">{esito.righe[r.codice]}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
