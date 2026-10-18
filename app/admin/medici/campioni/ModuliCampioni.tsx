"use client";

import { useActionState } from "react";
import { Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { aggiornaRichiestaCampioni } from "./azioni";

export function FormEsitoCampioni({ id, stato }: { id: string; stato: string }) {
  const [esito, azione] = useActionState<StatoModulo, FormData>(aggiornaRichiestaCampioni.bind(null, id), {});
  return (
    <form action={azione} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <div>
          <label htmlFor={`stato-${id}`} className="etichetta">Nuovo stato</label>
          <select id={`stato-${id}`} name="stato" defaultValue={stato === "nuova" ? "in_lavorazione" : stato} className="select">
            <option value="in_lavorazione">In lavorazione</option>
            <option value="spedita">Spedita</option>
            <option value="non_accolta">Non accolta</option>
          </select>
        </div>
        <div>
          <label htmlFor={`msg-${id}`} className="etichetta">Messaggio al medico (facoltativo)</label>
          <input id={`msg-${id}`} name="messaggio_admin" maxLength={1000} className="input" placeholder="Es. corriere e numero di spedizione" />
        </div>
      </div>
      <Casella nome="avvisa" selezionata>
        Avvisa il medico via email
      </Casella>
      <EsitoModulo ok={esito.ok} messaggio={esito.messaggio} />
      <PulsanteInvio variante="secondary" inCorso="Salvataggio…">Aggiorna</PulsanteInvio>
    </form>
  );
}
