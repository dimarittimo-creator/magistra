"use client";

import { useActionState } from "react";
import { Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { gestisciDomanda, rispondiInChat } from "./azioni";

export function RispostaOperatore({ conversazioneId, richiestaAperta }: { conversazioneId: string; richiestaAperta: boolean }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(rispondiInChat.bind(null, conversazioneId), {});
  return (
    <form action={azione} className="space-y-3" key={stato.ok ? stato.messaggio : "risposta"}>
      <div>
        <label htmlFor="campo-testo" className="etichetta">
          Risposta al cliente
        </label>
        <textarea
          id="campo-testo"
          name="testo"
          rows={5}
          maxLength={4000}
          className="textarea"
          defaultValue={stato.ok ? "" : stato.valori?.testo}
          aria-invalid={stato.errori?.testo ? true : undefined}
          aria-describedby={stato.errori?.testo ? "campo-testo-errore" : "campo-testo-aiuto"}
        />
        <p id="campo-testo-aiuto" className="aiuto">
          Compare nella chat del cliente come «Operatore Magistra»; il cliente riceve anche un&apos;email di avviso.
        </p>
        {stato.errori?.testo && (
          <p id="campo-testo-errore" className="errore-campo">
            {stato.errori.testo}
          </p>
        )}
      </div>
      <Casella nome="chiudi" selezionata={richiestaAperta}>
        Chiudi la richiesta dopo l&apos;invio (le domande successive tornano all&apos;assistente automatico)
      </Casella>
      <PulsanteInvio inCorso="Invio…">Invia risposta</PulsanteInvio>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
    </form>
  );
}

export function GestioneDomanda({ id, stato: statoAttuale, nota }: { id: string; stato: string; nota: string | null }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(gestisciDomanda.bind(null, id), {});
  return (
    <form action={azione} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor={`stato-${id}`} className="etichetta">
          Stato
        </label>
        <select id={`stato-${id}`} name="stato" defaultValue={statoAttuale} className="select">
          <option value="da_valutare">Da valutare</option>
          <option value="risolta">Risolta (informazione aggiunta)</option>
          <option value="ignorata">Da ignorare</option>
        </select>
      </div>
      <div className="flex-1 min-w-48">
        <label htmlFor={`nota-${id}`} className="etichetta">
          Nota
        </label>
        <input id={`nota-${id}`} name="nota" defaultValue={nota ?? ""} maxLength={1000} className="input" />
      </div>
      <PulsanteInvio variante="secondary" className="btn-piccolo" inCorso="…">
        Salva
      </PulsanteInvio>
      {stato.messaggio && (
        <span role={stato.ok ? "status" : "alert"} className={`text-sm ${stato.ok ? "text-slate" : "text-danger"}`}>
          {stato.messaggio}
        </span>
      )}
    </form>
  );
}
