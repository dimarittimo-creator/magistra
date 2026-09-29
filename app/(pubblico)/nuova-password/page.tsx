"use client";

import { useActionState } from "react";
import { CampoPassword, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { impostaNuovaPassword } from "../recupero-password/azioni";

// Si arriva qui dal link dell'email di recupero (già collegati). proxy.ts rimanda
// all'accesso chi apre la pagina senza sessione.
export default function NuovaPassword() {
  const [stato, azione] = useActionState<StatoModulo, FormData>(impostaNuovaPassword, {});
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <title>Nuova password · Magistra – Semplicemente Magistrale</title>
      <div className="panel p-6 sm:p-8">
        <h1 className="text-3xl text-magistra-blu">
          Scegli una nuova password
          <span className="filetto" aria-hidden="true" />
        </h1>
        <form action={azione} className="mt-6 space-y-5" noValidate>
          <CampoPassword nome="password" etichetta="Nuova password" obbligatorio autoComplete="new-password"
            errore={stato.errori?.password} aiuto="Almeno 8 caratteri, con lettere e numeri" />
          <CampoPassword nome="conferma_password" etichetta="Ripeti la nuova password" obbligatorio autoComplete="new-password"
            errore={stato.errori?.conferma_password} />
          <EsitoModulo messaggio={stato.messaggio} />
          <PulsanteInvio inCorso="Salvataggio…">Salva la nuova password</PulsanteInvio>
        </form>
      </div>
    </div>
  );
}
