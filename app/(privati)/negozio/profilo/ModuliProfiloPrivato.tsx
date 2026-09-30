"use client";

import { useActionState } from "react";
import { CampiPrivato } from "@/components/CampiPrivato";
import { CampoPassword, Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { cambiaPasswordPrivato, consensoMarketingPrivato, salvaProfiloPrivato } from "./azioni";

export function FormProfiloPrivato({ iniziali }: { iniziali: Record<string, string> }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(salvaProfiloPrivato, {});
  const v = { ...iniziali, ...stato.valori, nome: iniziali.nome, cognome: iniziali.cognome, codice_fiscale: iniziali.codice_fiscale };
  return (
    <form action={azione} className="space-y-6" noValidate>
      <CampiPrivato anagrafica="bloccata" valori={v} errori={stato.errori} />
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Salvataggio…">Salva</PulsanteInvio>
    </form>
  );
}

export function FormPasswordPrivato() {
  const [stato, azione] = useActionState<StatoModulo, FormData>(cambiaPasswordPrivato, {});
  return (
    <form action={azione} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoPassword nome="password" etichetta="Nuova password" obbligatorio autoComplete="new-password" errore={stato.errori?.password} />
        <CampoPassword nome="conferma_password" etichetta="Ripeti la nuova password" obbligatorio autoComplete="new-password" errore={stato.errori?.conferma_password} />
      </div>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio variante="secondary" inCorso="…">Cambia password</PulsanteInvio>
    </form>
  );
}

export function FormMarketingPrivato({ accettato }: { accettato: boolean }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(consensoMarketingPrivato, {});
  return (
    <form action={azione} className="space-y-3">
      <Casella nome="accetto_marketing" selezionata={accettato}>Desidero ricevere via email le offerte del mese e le novità.</Casella>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio variante="secondary" inCorso="…">Salva la preferenza</PulsanteInvio>
    </form>
  );
}
