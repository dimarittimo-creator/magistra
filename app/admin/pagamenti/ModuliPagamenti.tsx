"use client";

import { useActionState, useState } from "react";
import { Campo, Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { aggiungiLimite, salvaModalita } from "./azioni";

export type Modalita = {
  id: string;
  descrizione: string;
  canale: "farmacie" | "privati" | "entrambi";
  richiede_iban: boolean;
  contrassegno: boolean;
  costo_aggiuntivo_cent: number;
  attiva: boolean;
  ordine: number;
};

const CANALI = { farmacie: "Farmacie", privati: "Privati", entrambi: "Farmacie e privati" };

export function FormModalita({ modalita, onFatto }: { modalita?: Modalita; onFatto?: () => void }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(async (p: StatoModulo, fd: FormData) => {
    const r = await salvaModalita(modalita?.id ?? null, p, fd);
    if (r.ok) onFatto?.();
    return r;
  }, {});
  const v = stato.valori ?? {
    descrizione: modalita?.descrizione ?? "",
    canale: modalita?.canale ?? "farmacie",
    costo_aggiuntivo: modalita ? (modalita.costo_aggiuntivo_cent / 100).toFixed(2).replace(".", ",") : "0,00",
    ordine: String(modalita?.ordine ?? 100),
    richiede_iban: modalita?.richiede_iban ? "on" : "",
    contrassegno: modalita?.contrassegno ? "on" : "",
    attiva: modalita?.attiva === false ? "" : "on",
  };
  const e = stato.errori ?? {};
  const pre = modalita?.id ?? "nuova";
  return (
    <form action={azione} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-4">
        <Campo nome="descrizione" etichetta="Nome" obbligatorio valore={v.descrizione} errore={e.descrizione} className="sm:col-span-2" />
        <div>
          <label htmlFor={`canale-${pre}`} className="etichetta">Canale</label>
          <select id={`canale-${pre}`} name="canale" defaultValue={v.canale} className="select">
            {Object.entries(CANALI).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </div>
        <Campo nome="ordine" etichetta="Posizione nell'elenco" valore={v.ordine} errore={e.ordine} inputMode="numeric" />
        <Campo nome="costo_aggiuntivo" etichetta="Costo aggiuntivo (€)" valore={v.costo_aggiuntivo} errore={e.costo_aggiuntivo} />
      </div>
      <div className="flex flex-wrap gap-6">
        <Casella nome="richiede_iban" selezionata={v.richiede_iban === "on"}>Bonifico (mostra l&apos;IBAN della società)</Casella>
        <Casella nome="contrassegno" selezionata={v.contrassegno === "on"}>Contrassegno (importo in evidenza per il deposito)</Casella>
        {modalita && <Casella nome="attiva" selezionata={v.attiva === "on"}>Attiva</Casella>}
      </div>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Salvataggio…" className="btn-piccolo">{modalita ? "Salva" : "Crea modalità"}</PulsanteInvio>
    </form>
  );
}

export function ModificaModalita({ modalita }: { modalita: Modalita }) {
  const [aperto, setAperto] = useState(false);
  return aperto ? (
    <div className="mt-3 rounded-lg border border-line p-4">
      <FormModalita modalita={modalita} onFatto={() => setAperto(false)} />
      <button type="button" className="btn btn-secondary btn-piccolo mt-3" onClick={() => setAperto(false)}>Chiudi</button>
    </div>
  ) : (
    <button type="button" className="btn btn-secondary btn-piccolo" onClick={() => setAperto(true)}>Modifica</button>
  );
}

export function AggiungiLimite({ modalitaId, gruppi, farmacie }: { modalitaId: string; gruppi: { id: string; nome: string }[]; farmacie: { id: string; nome: string }[] }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(aggiungiLimite.bind(null, modalitaId), {});
  return (
    <form action={azione} className="flex flex-wrap items-center gap-2">
      <label htmlFor={`dest-${modalitaId}`} className="sr-only">Limita a</label>
      <select id={`dest-${modalitaId}`} name="destinatario" className="select w-auto max-w-xs" defaultValue="">
        <option value="">Limita a un gruppo o una farmacia…</option>
        <optgroup label="Gruppi">{gruppi.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.nome}</option>)}</optgroup>
        <optgroup label="Farmacie">{farmacie.map((f) => <option key={f.id} value={`f:${f.id}`}>{f.nome}</option>)}</optgroup>
      </select>
      <PulsanteInvio variante="secondary" inCorso="…" className="btn-piccolo">Aggiungi</PulsanteInvio>
      {stato.messaggio && <span role="alert" className="text-sm text-danger">{stato.messaggio}</span>}
    </form>
  );
}
