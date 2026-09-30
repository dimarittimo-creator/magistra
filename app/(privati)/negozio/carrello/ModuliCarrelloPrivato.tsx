"use client";

import { useActionState, useState } from "react";
import { Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { formattaEuro } from "@/lib/formato";
import { aggiornaProdotto } from "./azioni";
import { inviaOrdinePrivato, type StatoInvioPrivato } from "./invio";

export function QuantitaProdotto({ codice, quantita, nome }: { codice: string; quantita: number; nome: string }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(aggiornaProdotto.bind(null, codice), {});
  return (
    <form action={azione} className="flex flex-wrap items-center gap-2">
      <label htmlFor={`q-${codice}`} className="sr-only">Quantità {nome}</label>
      <select id={`q-${codice}`} name="quantita" defaultValue={quantita} key={quantita} className="select w-20" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {Array.from({ length: Math.max(10, quantita) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <button type="submit" name="azione" value="rimuovi" className="btn btn-secondary btn-piccolo" aria-label={`Rimuovi ${nome}`}>Rimuovi</button>
      {stato.messaggio && <p role="alert" className="errore-campo w-full">{stato.messaggio}</p>}
    </form>
  );
}

type Societa = { id: string; nome_breve: string; ragione_sociale: string; iban: string | null };
type Pagamento = { id: string; descrizione: string; richiede_iban: boolean; contrassegno: boolean; costo_aggiuntivo_cent: number };

export function FormOrdinePrivato(p: {
  societa: Societa[];
  pagamenti: Pagamento[];
  condizioniId: string;
  condizioniVersione: number;
  testoCondizioni: React.ReactNode;
  prodottiCent: number;
  speseCent: number | null;
  totaleCent: number;
  consegnaGiorni: number;
  inviabile: boolean;
}) {
  const [stato, azione] = useActionState<StatoInvioPrivato, FormData>(inviaOrdinePrivato, {});
  const [societaId, setSocietaId] = useState(p.societa[0]?.id ?? "");
  const [pagamentoId, setPagamentoId] = useState("");
  const scelta = p.societa.find((s) => s.id === societaId);
  const pagamento = p.pagamenti.find((x) => x.id === pagamentoId);
  const costo = pagamento?.costo_aggiuntivo_cent ?? 0;
  const e = stato.errori ?? {};

  return (
    <form action={azione} className="space-y-6" noValidate>
      <input type="hidden" name="condizioni_documento_id" value={p.condizioniId} />
      {p.societa.length > 1 ? (
        <div>
          <label htmlFor="societa_id" className="etichetta">Venduto e spedito da</label>
          <select id="societa_id" name="societa_id" value={societaId} onChange={(ev) => setSocietaId(ev.target.value)} className="select">
            {p.societa.map((s) => <option key={s.id} value={s.id}>{s.ragione_sociale}</option>)}
          </select>
          {e.societa_id && <p className="errore-campo">{e.societa_id}</p>}
        </div>
      ) : (
        <input type="hidden" name="societa_id" value={societaId} />
      )}

      <div>
        <label htmlFor="modalita_pagamento_id" className="etichetta">Come vuoi pagare? <span className="text-danger" aria-hidden="true">*</span></label>
        <select id="modalita_pagamento_id" name="modalita_pagamento_id" value={pagamentoId} onChange={(ev) => setPagamentoId(ev.target.value)} className="select"
          aria-invalid={e.modalita_pagamento_id ? true : undefined}>
          <option value="">Scegli…</option>
          {p.pagamenti.map((x) => (
            <option key={x.id} value={x.id} disabled={x.richiede_iban && !scelta?.iban}>
              {x.descrizione}{x.costo_aggiuntivo_cent ? ` (+ ${formattaEuro(x.costo_aggiuntivo_cent)})` : ""}
            </option>
          ))}
        </select>
        {pagamento?.richiede_iban && <p className="aiuto">Riceverai l&apos;IBAN per email; spediamo appena arriva il pagamento.</p>}
        {pagamento?.contrassegno && <p className="aiuto">Paghi al corriere alla consegna.</p>}
        {e.modalita_pagamento_id && <p className="errore-campo">{e.modalita_pagamento_id}</p>}
      </div>

      <div>
        <label htmlFor="note" className="etichetta">Note per la consegna (facoltative)</label>
        <textarea id="note" name="note" rows={2} maxLength={500} className="textarea" />
      </div>

      <section aria-labelledby="t-riepilogo" className="rounded-lg bg-grey-soft p-4">
        <h3 id="t-riepilogo" className="text-xl font-serif text-magistra-blu mb-3">Riepilogo</h3>
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 max-w-md ml-auto">
          <dt className="text-muted">Prodotti</dt><dd className="text-right tabular-nums">{formattaEuro(p.prodottiCent)}</dd>
          <dt className="text-muted">Spedizione</dt>
          <dd className="text-right tabular-nums">{p.speseCent == null ? "—" : p.speseCent === 0 ? "gratuita" : formattaEuro(p.speseCent)}</dd>
          {costo > 0 && (<><dt className="text-muted">{pagamento?.descrizione}</dt><dd className="text-right tabular-nums">{formattaEuro(costo)}</dd></>)}
          <dt className="text-lg font-bold border-t border-line pt-2">Totale</dt>
          <dd className="text-lg font-bold text-right tabular-nums border-t border-line pt-2">{formattaEuro(p.totaleCent + costo)}</dd>
          <dt className="text-xs text-muted col-span-2 text-right">IVA inclusa · consegna indicativa entro {p.consegnaGiorni} giorni lavorativi dalla conferma</dt>
        </dl>
      </section>

      <section aria-labelledby="t-condizioni" className="space-y-3">
        <h3 id="t-condizioni" className="text-xl font-serif text-magistra-blu">Condizioni di vendita (versione {p.condizioniVersione})</h3>
        <div className="rounded-lg border border-line p-4 max-h-56 overflow-y-auto text-sm">{p.testoCondizioni}</div>
        <Casella nome="accetto_condizioni" errore={e.accetto_condizioni}>
          <strong>Ho letto e accetto</strong> le condizioni di vendita. <span className="text-danger" aria-hidden="true">*</span>
        </Casella>
      </section>

      <EsitoModulo messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Invio dell'ordine…" className={`w-full sm:w-auto ${p.inviabile ? "" : "opacity-50"}`}>Conferma l&apos;ordine</PulsanteInvio>
    </form>
  );
}
