"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CampiMedico } from "@/components/CampiMedico";
import { CampoPassword, Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { registraMedico } from "./azioni";

export function FormRegistrazioneMedico({ versionePrivacy }: { versionePrivacy: number }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(registraMedico, {});
  const e = stato.errori ?? {};
  const v = stato.valori ?? {};
  return (
    <form action={azione} className="space-y-8" noValidate>
      <CampiMedico identificativi="modificabili" valori={v} errori={e} />
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Password</legend>
        <CampoPassword nome="password" etichetta="Password" obbligatorio autoComplete="new-password" errore={e.password} aiuto="Almeno 8 caratteri, con lettere e numeri" />
        <CampoPassword nome="conferma_password" etichetta="Ripeti la password" obbligatorio autoComplete="new-password" errore={e.conferma_password} />
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Dichiarazioni e consensi</legend>
        <Casella nome="dichiaro_medico" selezionata={v.dichiaro_medico === "on"} errore={e.dichiaro_medico}>
          Dichiaro di essere medico iscritto all&apos;Ordine indicato. <span className="text-danger" aria-hidden="true">*</span>
        </Casella>
        <Casella nome="accetto_privacy" selezionata={v.accetto_privacy === "on"} errore={e.accetto_privacy}>
          Ho letto l&apos;<Link href="/privacy" target="_blank">informativa sul trattamento dei dati personali</Link> (versione {versionePrivacy}). <span className="text-danger" aria-hidden="true">*</span>
        </Casella>
        <Casella nome="accetto_marketing" selezionata={v.accetto_marketing === "on"}>
          Desidero ricevere via email novità scientifiche e sui prodotti (facoltativo, revocabile in ogni momento dal profilo).
        </Casella>
      </fieldset>
      <EsitoModulo messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Invio della richiesta…" className="w-full sm:w-auto">Invia la richiesta di accesso</PulsanteInvio>
    </form>
  );
}
