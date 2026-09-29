"use client";

import { useActionState } from "react";
import { Campo, Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { pubblicaVersione } from "./azioni";

export function FormVersione({ tipo, titolo, testo }: { tipo: string; titolo: string; testo: string }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(pubblicaVersione, {});
  const v = stato.valori ?? { titolo, testo };
  const e = stato.errori ?? {};
  if (stato.ok) return <EsitoModulo ok messaggio={stato.messaggio} />;
  return (
    <form action={azione} className="space-y-4" noValidate>
      <input type="hidden" name="tipo" value={tipo} />
      <Campo nome="titolo" etichetta="Titolo" obbligatorio valore={v.titolo} errore={e.titolo} />
      <div>
        <label htmlFor={`testo-${tipo}`} className="etichetta">Testo</label>
        <textarea id={`testo-${tipo}`} name="testo" rows={14} defaultValue={v.testo} className="textarea font-mono text-sm" aria-describedby={`aiuto-${tipo}`} />
        <p id={`aiuto-${tipo}`} className="aiuto">
          Paragrafi separati da una riga vuota; **testo** per il grassetto; righe che iniziano con «1. », «2. »… diventano un elenco numerato.
        </p>
        {e.testo && <p className="errore-campo">{e.testo}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 items-end">
        <Campo nome="in_vigore_dal" etichetta="In vigore dal" tipo="date" valore={v.in_vigore_dal} errore={e.in_vigore_dal} aiuto="Vuoto = da subito" />
        <Casella nome="provvisorio" selezionata={v.provvisorio === "on"}>Testo provvisorio (mostra l&apos;avviso giallo)</Casella>
      </div>
      <EsitoModulo messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Pubblicazione…">Pubblica come nuova versione</PulsanteInvio>
    </form>
  );
}
