"use client";

import { useActionState, useState } from "react";
import { CampiMedico } from "@/components/CampiMedico";
import { Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { approvaMedico, bloccaMedico, salvaDatiMedicoAdmin } from "../azioni";

export function AzioniStatoMedico({ id, stato }: { id: string; stato: "in_attesa" | "attivo" | "bloccato" }) {
  const [esitoApprova, approva] = useActionState<StatoModulo>(() => approvaMedico(id), {});
  const [esitoBlocca, blocca] = useActionState<StatoModulo, FormData>(bloccaMedico.bind(null, id), {});
  const [bloccoAperto, setBloccoAperto] = useState(false);
  const esito = esitoApprova.messaggio ? esitoApprova : esitoBlocca;

  return (
    <div className="space-y-4">
      <EsitoModulo ok={esito.ok} messaggio={esito.messaggio} />
      <div className="flex flex-wrap gap-3">
        {stato !== "attivo" && (
          <form action={approva}>
            <PulsanteInvio inCorso="Approvazione…">{stato === "bloccato" ? "Riattiva l'accesso" : "Approva l'accesso"}</PulsanteInvio>
          </form>
        )}
        {stato !== "bloccato" && !bloccoAperto && (
          <button type="button" className="btn btn-secondary" onClick={() => setBloccoAperto(true)}>
            {stato === "in_attesa" ? "Rifiuta la richiesta" : "Blocca l'accesso"}
          </button>
        )}
      </div>
      {stato !== "bloccato" && bloccoAperto && (
        <form action={blocca} className="space-y-4 border border-line rounded-lg p-4">
          <div>
            <label htmlFor="motivo_blocco" className="etichetta">Motivo (facoltativo, compare nell&apos;email al medico)</label>
            <textarea id="motivo_blocco" name="motivo_blocco" rows={2} className="textarea" />
          </div>
          <Casella nome="avvisa" selezionata>
            Avvisa il medico via email
          </Casella>
          <div className="flex flex-wrap gap-3">
            <PulsanteInvio inCorso="Salvataggio…">Conferma</PulsanteInvio>
            <button type="button" className="btn btn-secondary" onClick={() => setBloccoAperto(false)}>Annulla</button>
          </div>
        </form>
      )}
    </div>
  );
}

export function FormDatiMedicoAdmin({ id, valoriIniziali, noteAdmin }: { id: string; valoriIniziali: Record<string, string>; noteAdmin: string }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(salvaDatiMedicoAdmin.bind(null, id), {});
  const v = { ...valoriIniziali, note_admin: noteAdmin, ...stato.valori };
  return (
    <form action={azione} className="space-y-6" noValidate>
      <CampiMedico identificativi="modificabili" valori={v} errori={stato.errori} />
      <div>
        <label htmlFor="note_admin" className="etichetta">Note interne (non visibili al medico)</label>
        <textarea id="note_admin" name="note_admin" rows={3} defaultValue={v.note_admin} className="textarea" />
      </div>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Salvataggio…">Salva i dati</PulsanteInvio>
    </form>
  );
}
