"use client";

import { useActionState } from "react";
import { EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { richiediCampioni } from "./azioni";

export function FormCampioni({ prodotti, massimo, scelto }: { prodotti: { codice: string; nome: string }[]; massimo: number; scelto?: string }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(richiediCampioni, {});
  const e = stato.errori ?? {};
  // Dopo un invio riuscito il modulo riparte vuoto
  const v = stato.ok ? {} : (stato.valori ?? {});
  return (
    <form action={azione} key={stato.ok ? stato.messaggio : "modulo"} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-[3fr_1fr]">
        <div>
          <label htmlFor="campo-prodotto" className="etichetta">
            Prodotto<span className="text-danger" aria-hidden="true"> *</span>
          </label>
          <select id="campo-prodotto" name="prodotto" required defaultValue={v.prodotto ?? scelto ?? ""} className="select"
            aria-invalid={e.prodotto ? true : undefined} aria-describedby={e.prodotto ? "campo-prodotto-errore" : undefined}>
            <option value="">Scelga…</option>
            {prodotti.map((p) => (
              <option key={p.codice} value={p.codice}>{p.nome}</option>
            ))}
          </select>
          {e.prodotto && <p id="campo-prodotto-errore" className="errore-campo">{e.prodotto}</p>}
        </div>
        <div>
          <label htmlFor="campo-quantita" className="etichetta">
            Confezioni<span className="text-danger" aria-hidden="true"> *</span>
          </label>
          <input id="campo-quantita" name="quantita" type="number" min={1} max={massimo} required defaultValue={v.quantita ?? "1"} className="input"
            aria-invalid={e.quantita ? true : undefined} aria-describedby="campo-quantita-aiuto" />
          <p id="campo-quantita-aiuto" className={e.quantita ? "errore-campo" : "aiuto"}>{e.quantita ?? `Massimo ${massimo}`}</p>
        </div>
      </div>
      <div>
        <label htmlFor="campo-note" className="etichetta">Note (facoltative)</label>
        <textarea id="campo-note" name="note" rows={3} maxLength={1000} defaultValue={v.note} className="textarea"
          placeholder="Es. orari dello studio per la consegna" />
        {e.note && <p className="errore-campo">{e.note}</p>}
      </div>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Invio…">Invia la richiesta</PulsanteInvio>
    </form>
  );
}
