"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CampiFarmacia } from "@/components/CampiFarmacia";
import { CampoPassword, Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { registraFarmacia } from "./azioni";

export function FormRegistrazione({ versionePrivacy, versioneCondizioni }: { versionePrivacy: number; versioneCondizioni: number }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(registraFarmacia, {});
  const errori = stato.errori ?? {};
  const valori = stato.valori ?? {};

  return (
    <form action={azione} className="space-y-8" noValidate>
      <CampiFarmacia
        identificativi="modificabili"
        valori={valori}
        errori={errori}
        etichettaEmail="Email (per accedere e ricevere le comunicazioni)"
      />

      <fieldset className="space-y-4">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Password di accesso</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoPassword nome="password" etichetta="Password" obbligatorio autoComplete="new-password"
            errore={errori.password} aiuto="Almeno 8 caratteri, con lettere e numeri" />
          <CampoPassword nome="conferma_password" etichetta="Ripeti la password" obbligatorio autoComplete="new-password"
            errore={errori.conferma_password} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Consensi</legend>
        <Casella nome="accetto_privacy" obbligatoria selezionata={valori.accetto_privacy === "on"} errore={errori.accetto_privacy}>
          Ho letto l&apos;
          <Link href="/privacy" target="_blank">
            informativa sul trattamento dei dati personali
          </Link>{" "}
          (versione {versionePrivacy}). <span className="text-danger" aria-hidden="true">*</span>
        </Casella>
        <Casella nome="accetto_condizioni" obbligatoria selezionata={valori.accetto_condizioni === "on"} errore={errori.accetto_condizioni}>
          Accetto le{" "}
          <Link href="/condizioni/farmacie" target="_blank">
            condizioni di vendita per le farmacie
          </Link>{" "}
          (versione {versioneCondizioni}). <span className="text-danger" aria-hidden="true">*</span>
        </Casella>
        <Casella nome="accetto_marketing" selezionata={valori.accetto_marketing === "on"}>
          Desidero ricevere via email promozioni e novità sui prodotti di Sagè Pharma e Bioeleva (facoltativo, revocabile in
          qualsiasi momento dal profilo).
        </Casella>
      </fieldset>

      <EsitoModulo messaggio={stato.messaggio} />
      <p className="aiuto">
        I campi con <span className="text-danger">*</span> sono obbligatori.
      </p>
      <PulsanteInvio inCorso="Invio della richiesta…" className="w-full sm:w-auto">
        Invia la richiesta di iscrizione
      </PulsanteInvio>
    </form>
  );
}
