"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CampiPrivato } from "@/components/CampiPrivato";
import { CampoPassword, Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { registraPrivato } from "./azioni";

export function FormRegistrazionePrivato({ versionePrivacy, versioneCondizioni, prossima }: { versionePrivacy: number; versioneCondizioni: number; prossima?: string }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(registraPrivato, {});
  const e = stato.errori ?? {};
  const v = stato.valori ?? {};
  return (
    <form action={azione} className="space-y-8" noValidate>
      <input type="hidden" name="prossima" value={prossima ?? ""} />
      <CampiPrivato anagrafica="modificabile" valori={v} errori={e} />
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Password</legend>
        <CampoPassword nome="password" etichetta="Password" obbligatorio autoComplete="new-password" errore={e.password} aiuto="Almeno 8 caratteri, con lettere e numeri" />
        <CampoPassword nome="conferma_password" etichetta="Ripeti la password" obbligatorio autoComplete="new-password" errore={e.conferma_password} />
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Consensi</legend>
        <Casella nome="accetto_privacy" selezionata={v.accetto_privacy === "on"} errore={e.accetto_privacy}>
          Ho letto l&apos;<Link href="/privacy" target="_blank">informativa sul trattamento dei dati personali</Link> (versione {versionePrivacy}). <span className="text-danger" aria-hidden="true">*</span>
        </Casella>
        <Casella nome="accetto_condizioni" selezionata={v.accetto_condizioni === "on"} errore={e.accetto_condizioni}>
          Accetto le <Link href="/condizioni/privati" target="_blank">condizioni di vendita</Link> (versione {versioneCondizioni}). <span className="text-danger" aria-hidden="true">*</span>
        </Casella>
        <Casella nome="accetto_marketing" selezionata={v.accetto_marketing === "on"}>
          Desidero ricevere via email le offerte del mese e le novità (facoltativo, revocabile in ogni momento dal profilo).
        </Casella>
      </fieldset>
      <EsitoModulo messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Creazione dell'account…" className="w-full sm:w-auto">Crea il mio account</PulsanteInvio>
    </form>
  );
}
