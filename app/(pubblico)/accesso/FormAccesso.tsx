"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Campo, CampoPassword, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import { accedi, reinviaConferma, type StatoAccesso } from "./azioni";

export function FormAccesso({ prossima }: { prossima?: string }) {
  const [stato, azione] = useActionState<StatoAccesso, FormData>(accedi, {});
  return (
    <>
      <form action={azione} className="space-y-5" noValidate>
        <input type="hidden" name="prossima" value={prossima ?? ""} />
        <Campo nome="email" etichetta="Email" tipo="email" autoComplete="email" obbligatorio valore={stato.valori?.email} inputMode="email" />
        <CampoPassword nome="password" etichetta="Password" autoComplete="current-password" obbligatorio />
        <EsitoModulo messaggio={stato.messaggio} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PulsanteInvio inCorso="Accesso in corso…">Accedi</PulsanteInvio>
          <Link href="/recupero-password" className="text-sm">
            Password dimenticata?
          </Link>
        </div>
      </form>
      {stato.emailDaConfermare && <ReinvioConferma email={stato.emailDaConfermare} />}
    </>
  );
}

function ReinvioConferma({ email }: { email: string }) {
  const [stato, azione] = useActionState(reinviaConferma, {});
  return (
    <form action={azione} className="mt-4 space-y-3">
      <input type="hidden" name="email" value={email} />
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      {!stato.ok && (
        <PulsanteInvio variante="secondary" inCorso="Invio…">
          Invia di nuovo l&apos;email di conferma
        </PulsanteInvio>
      )}
    </form>
  );
}
