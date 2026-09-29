"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Campo, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { richiediRecupero } from "./azioni";

export default function RecuperoPassword() {
  const [stato, azione] = useActionState<StatoModulo, FormData>(richiediRecupero, {});
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <title>Recupero password · Magistra – Semplicemente Magistrale</title>
      <div className="panel p-6 sm:p-8">
        <h1 className="text-3xl text-magistra-blu">
          Password dimenticata
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted">Indica l&apos;email del tuo account: ti invieremo un link per scegliere una nuova password.</p>
        {stato.ok ? (
          <div className="mt-6 space-y-6">
            <EsitoModulo ok messaggio={stato.messaggio} />
            <Link href="/accesso" className="btn btn-secondary">
              Torna all&apos;accesso
            </Link>
          </div>
        ) : (
          <form action={azione} className="mt-6 space-y-5" noValidate>
            <Campo nome="email" etichetta="Email" tipo="email" obbligatorio autoComplete="email" inputMode="email"
              valore={stato.valori?.email} errore={stato.errori?.email} />
            <EsitoModulo messaggio={stato.messaggio} />
            <div className="flex flex-wrap items-center gap-4">
              <PulsanteInvio inCorso="Invio…">Invia il link</PulsanteInvio>
              <Link href="/accesso" className="text-sm">
                Torna all&apos;accesso
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
