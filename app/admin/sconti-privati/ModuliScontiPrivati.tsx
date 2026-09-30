"use client";

import { useActionState, useState, useTransition } from "react";
import { Campo, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { formattaEuro } from "@/lib/formato";
import { prezzoPrivato } from "@/lib/pricing";
import { migliorScontoPrivati, type ScontoPrivati } from "@/lib/sconti-privati";
import { copiaMeseSuccessivo, creaScontoPrivati, terminaSconto } from "./azioni";

type Prodotto = { codice: string; nome: string; lineaId: string | null; pieno: number; iva: number };
type Opzione = { id: string; nome: string };

/** Nuovo sconto con anteprima dei prezzi finali (vale il migliore tra gli sconti del periodo). */
export function NuovoSconto({ prodotti, linee, esistenti, periodo }: { prodotti: Prodotto[]; linee: Opzione[]; esistenti: ScontoPrivati[]; periodo: { inizio: string; fine: string } }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(creaScontoPrivati, {});
  const [ambito, setAmbito] = useState("catalogo");
  const [lineaId, setLineaId] = useState("");
  const [codice, setCodice] = useState("");
  const [sconto, setSconto] = useState("");
  const [inizio, setInizio] = useState(periodo.inizio);
  const e = stato.errori ?? {};

  const percentuale = Number(sconto.replace(",", "."));
  const nuovo: ScontoPrivati | null =
    percentuale > 0 && percentuale <= 100
      ? { id: "nuovo", ambito: ambito as ScontoPrivati["ambito"], linea_id: ambito === "linea" ? lineaId : null, prodotto_codice: ambito === "prodotto" ? codice : null, sconto_percentuale: percentuale, inizio, fine: inizio }
      : null;
  const anteprima = prodotti
    .map((p) => {
      const prima = migliorScontoPrivati(esistenti, { codice: p.codice, lineaId: p.lineaId }, inizio);
      const dopo = migliorScontoPrivati([...esistenti, ...(nuovo ? [nuovo] : [])], { codice: p.codice, lineaId: p.lineaId }, inizio);
      return { p, prima, dopo };
    })
    .filter((x) => x.dopo?.id === "nuovo");

  if (stato.ok) {
    return (
      <div className="space-y-3">
        <EsitoModulo ok messaggio={stato.messaggio} />
        <button type="button" className="btn btn-secondary btn-piccolo" onClick={() => window.location.reload()}>Aggiungi un altro sconto</button>
      </div>
    );
  }
  return (
    <form action={azione} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label htmlFor="ambito" className="etichetta">Su cosa</label>
          <select id="ambito" name="ambito" value={ambito} onChange={(ev) => setAmbito(ev.target.value)} className="select">
            <option value="catalogo">Tutto il negozio</option>
            <option value="linea">Una linea</option>
            <option value="prodotto">Un prodotto</option>
          </select>
        </div>
        {ambito === "linea" && (
          <div>
            <label htmlFor="linea_id" className="etichetta">Linea</label>
            <select id="linea_id" name="linea_id" value={lineaId} onChange={(ev) => setLineaId(ev.target.value)} className="select">
              <option value="">Scegli…</option>
              {linee.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
            {e.linea_id && <p className="errore-campo">{e.linea_id}</p>}
          </div>
        )}
        {ambito === "prodotto" && (
          <div className="sm:col-span-2">
            <label htmlFor="prodotto_codice" className="etichetta">Prodotto</label>
            <select id="prodotto_codice" name="prodotto_codice" value={codice} onChange={(ev) => setCodice(ev.target.value)} className="select">
              <option value="">Scegli…</option>
              {prodotti.map((p) => <option key={p.codice} value={p.codice}>{p.nome}</option>)}
            </select>
            {e.prodotto_codice && <p className="errore-campo">{e.prodotto_codice}</p>}
          </div>
        )}
        <div>
          <label htmlFor="sconto_percentuale" className="etichetta">Sconto %</label>
          <input id="sconto_percentuale" name="sconto_percentuale" value={sconto} onChange={(ev) => setSconto(ev.target.value)} inputMode="decimal" className="input" />
          {e.sconto_percentuale && <p className="errore-campo">{e.sconto_percentuale}</p>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label htmlFor="inizio" className="etichetta">Dal</label>
          <input id="inizio" name="inizio" type="date" value={inizio} onChange={(ev) => setInizio(ev.target.value)} className="input" />
        </div>
        <Campo nome="fine" etichetta="Al (compreso)" tipo="date" valore={periodo.fine} errore={e.fine} />
      </div>

      {nuovo && (
        <section aria-labelledby="t-anteprima" className="rounded-lg border border-line p-4">
          <h3 id="t-anteprima" className="font-semibold mb-2">Anteprima: {anteprima.length} prodotti cambiano prezzo</h3>
          {anteprima.length === 0 ? (
            <p className="text-sm text-muted">Nessun prezzo cambia: per questi prodotti c&apos;è già uno sconto uguale o migliore nel periodo.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              <table className="tabella text-sm">
                <thead><tr><th>Prodotto</th><th className="text-right">Prezzo pieno</th><th className="text-right">Ora</th><th className="text-right">Con il nuovo sconto</th></tr></thead>
                <tbody>
                  {anteprima.map(({ p, prima, dopo }) => (
                    <tr key={p.codice}>
                      <td>{p.nome}</td>
                      <td className="text-right">{formattaEuro(p.pieno)}</td>
                      <td className="text-right">{formattaEuro(prezzoPrivato(p.pieno, p.iva, prima ? Number(prima.sconto_percentuale) : null).ivatoCent)}</td>
                      <td className="text-right font-semibold">{formattaEuro(prezzoPrivato(p.pieno, p.iva, Number(dopo!.sconto_percentuale)).ivatoCent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      <EsitoModulo messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Salvataggio…">Salva lo sconto</PulsanteInvio>
    </form>
  );
}

export function AzioneSconto({ ids, tipo, testo }: { ids: string[]; tipo: "copia" | "termina"; testo: string }) {
  const [esito, setEsito] = useState<StatoModulo>({});
  const [inCorso, avvia] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="btn btn-secondary btn-piccolo" disabled={inCorso}
        onClick={() => avvia(async () => setEsito(tipo === "copia" ? await copiaMeseSuccessivo(ids) : await terminaSconto(ids[0])))}>
        {inCorso ? "…" : testo}
      </button>
      {esito.messaggio && <span role="status" className={`text-sm ${esito.ok ? "text-slate" : "text-danger"}`}>{esito.messaggio}</span>}
    </span>
  );
}
