"use client";

import { useActionState } from "react";
import { CampoPassword, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { cambiaPasswordStaff } from "./azioni";

export function FormPassword() {
  const [stato, azione] = useActionState<StatoModulo, FormData>(cambiaPasswordStaff, {});
  return (
    <form action={azione} className="space-y-5" noValidate key={stato.ok ? stato.messaggio : "password"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoPassword nome="password" etichetta="Nuova password" obbligatorio autoComplete="new-password"
          errore={stato.errori?.password} aiuto="Almeno 8 caratteri, con lettere e numeri" />
        <CampoPassword nome="conferma_password" etichetta="Ripeti la nuova password" obbligatorio autoComplete="new-password"
          errore={stato.errori?.conferma_password} />
      </div>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Salvataggio…">Cambia password</PulsanteInvio>
    </form>
  );
}
