"use client";

import { useActionState, useState } from "react";
import { Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { aggiornaRigaCarrello } from "./azioni";
import { inviaPrenotazione, type StatoInvio } from "./invio";

export function QuantitaRiga({ lottoId, quantita, massimo, etichetta }: { lottoId: string; quantita: number; massimo: number; etichetta: string }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(aggiornaRigaCarrello.bind(null, lottoId), {});
  const id = `q-${lottoId}`;
  return (
    <form action={azione} className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="sr-only">Quantità {etichetta}</label>
      <input id={id} name="quantita" type="number" inputMode="numeric" min={1} max={Math.max(massimo, quantita)} defaultValue={quantita}
        key={quantita} className="input w-24 text-right" />
      <PulsanteInvio variante="secondary" inCorso="…" className="btn-piccolo">Aggiorna</PulsanteInvio>
      <button type="submit" name="azione" value="rimuovi" className="btn btn-secondary btn-piccolo" aria-label={`Rimuovi ${etichetta}`}>
        Rimuovi
      </button>
      {stato.messaggio && <p role="alert" className="errore-campo w-full">{stato.messaggio}</p>}
    </form>
  );
}

type Societa = { id: string; nome_breve: string; ragione_sociale: string; sede: string; partita_iva: string; iban: string | null };
type Pagamento = { id: string; descrizione: string; richiede_iban: boolean; contrassegno: boolean };

export function FormInvio({
  societa,
  societaPredefinitaId,
  pagamenti,
  condizioniId,
  condizioniVersione,
  testoCondizioni,
  riepilogo,
  consegnaGiorni,
  domani,
  inviabile,
  etichetteLotti,
  totaleTesto,
}: {
  societa: Societa[];
  societaPredefinitaId: string;
  pagamenti: Pagamento[];
  condizioniId: string;
  condizioniVersione: number;
  testoCondizioni: React.ReactNode;
  riepilogo: React.ReactNode;
  consegnaGiorni: number;
  domani: string;
  inviabile: boolean;
  etichetteLotti: Record<string, string>;
  totaleTesto: string;
}) {
  const [stato, azione] = useActionState<StatoInvio, FormData>(inviaPrenotazione, {});
  const [societaId, setSocietaId] = useState(societaPredefinitaId);
  const [pagamentoId, setPagamentoId] = useState("");
  const scelta = societa.find((s) => s.id === societaId);
  const pagamento = pagamenti.find((p) => p.id === pagamentoId);
  const e = stato.errori ?? {};

  return (
    <form action={azione} className="space-y-6" noValidate>
      <input type="hidden" name="condizioni_documento_id" value={condizioniId} />

      {stato.righe && (
        <div role="alert" className="avviso avviso-errore space-y-1">
          <p className="font-semibold">{stato.messaggio}</p>
          <ul className="list-disc pl-5">
            {Object.entries(stato.righe).map(([lotto, msg]) => (
              <li key={lotto}>
                {etichetteLotti[lotto] ?? "Riga"}: {msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Società che fattura e consegna: il selettore compare solo se le società attive sono più di una */}
      {societa.length > 1 ? (
        <fieldset>
          <legend className="etichetta">Fattura e consegna <span className="text-danger" aria-hidden="true">*</span></legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {societa.map((s) => (
              <label key={s.id} className={`rounded-lg border p-3 cursor-pointer flex gap-3 ${s.id === societaId ? "border-brand bg-brand-soft" : "border-line"}`}>
                <input type="radio" name="societa_id" value={s.id} checked={s.id === societaId} onChange={() => setSocietaId(s.id)}
                  className="mt-1 size-5 accent-[var(--brand)]" />
                <span className="text-sm">
                  <span className="block font-semibold text-base">{s.nome_breve}</span>
                  {s.ragione_sociale} · P.IVA {s.partita_iva}
                  <span className="block text-muted">{s.sede}</span>
                </span>
              </label>
            ))}
          </div>
          {e.societa_id && <p className="errore-campo">{e.societa_id}</p>}
        </fieldset>
      ) : (
        <input type="hidden" name="societa_id" value={societaId} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="modalita_pagamento_id" className="etichetta">
            Modalità di pagamento <span className="text-danger" aria-hidden="true">*</span>
          </label>
          <select id="modalita_pagamento_id" name="modalita_pagamento_id" value={pagamentoId} onChange={(ev) => setPagamentoId(ev.target.value)}
            className="select" aria-invalid={e.modalita_pagamento_id ? true : undefined} aria-describedby="aiuto-pagamento">
            <option value="">Scegli…</option>
            {pagamenti.map((p) => (
              <option key={p.id} value={p.id} disabled={p.richiede_iban && !scelta?.iban}>
                {p.descrizione}
                {p.richiede_iban && !scelta?.iban ? " (non disponibile con questa società)" : ""}
              </option>
            ))}
          </select>
          <div id="aiuto-pagamento" className="aiuto">
            {pagamento?.richiede_iban && scelta?.iban && (
              <>IBAN {scelta.iban} intestato a {scelta.ragione_sociale}. Lo trovi anche nell&apos;email di conferma.</>
            )}
            {pagamento?.contrassegno && <>Alla consegna pagherai {totaleTesto}.</>}
          </div>
          {e.modalita_pagamento_id && <p className="errore-campo">{e.modalita_pagamento_id}</p>}
        </div>
        <div>
          <label htmlFor="data_consegna_desiderata" className="etichetta">Data di consegna desiderata (facoltativa)</label>
          <input id="data_consegna_desiderata" name="data_consegna_desiderata" type="date" min={domani} className="input"
            aria-invalid={e.data_consegna_desiderata ? true : undefined} />
          <p className="aiuto">Consegna indicativa entro {consegnaGiorni} giorni lavorativi dalla conferma: non è un termine garantito.</p>
          {e.data_consegna_desiderata && <p className="errore-campo">{e.data_consegna_desiderata}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="note" className="etichetta">Note per noi (facoltative)</label>
        <textarea id="note" name="note" rows={2} maxLength={1000} className="textarea" />
      </div>

      {riepilogo}

      <section aria-labelledby="titolo-condizioni" className="space-y-3">
        <h3 id="titolo-condizioni" className="text-xl font-serif text-magistra-blu">Condizioni di vendita (versione {condizioniVersione})</h3>
        <div className="rounded-lg border border-line p-4 max-h-64 overflow-y-auto text-sm">{testoCondizioni}</div>
        <p className="text-sm text-muted">Alla consegna controlla i colli e annota eventuali danni sul documento del corriere.</p>
        <Casella nome="accetto_condizioni" errore={e.accetto_condizioni}>
          <strong>Ho letto e accetto</strong> le condizioni di vendita. <span className="text-danger" aria-hidden="true">*</span>
        </Casella>
      </section>

      {!stato.righe && <EsitoModulo messaggio={stato.messaggio} />}
      <div className="flex flex-wrap items-center gap-4">
        <PulsanteInvio inCorso="Invio della prenotazione…" className={inviabile ? "" : "opacity-50"}>
          Invia la prenotazione
        </PulsanteInvio>
        <p className="text-sm text-muted">Prenotazione non vincolante: diventa definitiva con la nostra conferma.</p>
      </div>
    </form>
  );
}
