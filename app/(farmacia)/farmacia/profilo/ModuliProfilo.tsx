"use client";

import { useActionState } from "react";
import { CampiFarmacia } from "@/components/CampiFarmacia";
import { CampoPassword, Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { cambiaPassword, salvaConsensoMarketing, salvaProfilo } from "./azioni";

export function FormProfilo({ valoriIniziali }: { valoriIniziali: Record<string, string> }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(salvaProfilo, {});
  // I campi bloccati non vengono inviati: si mostrano sempre dai dati salvati.
  const valori = { ...valoriIniziali, ...stato.valori, ...bloccati(valoriIniziali) };
  return (
    <form action={azione} className="space-y-6" noValidate>
      <CampiFarmacia
        identificativi="bloccati"
        valori={valori}
        errori={stato.errori}
        etichettaEmail="Email per le comunicazioni"
        aiutoEmail="Per cambiare l'email con cui accedi contatta l'amministrazione"
      />
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Salvataggio…">Salva i dati</PulsanteInvio>
    </form>
  );
}

function bloccati(v: Record<string, string>) {
  return { ragione_sociale: v.ragione_sociale, partita_iva: v.partita_iva, codice_fiscale: v.codice_fiscale, codice_farmacia: v.codice_farmacia };
}

export function FormPassword() {
  const [stato, azione] = useActionState<StatoModulo, FormData>(cambiaPassword, {});
  return (
    <form action={azione} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoPassword nome="password" etichetta="Nuova password" obbligatorio autoComplete="new-password"
          errore={stato.errori?.password} aiuto="Almeno 8 caratteri, con lettere e numeri" />
        <CampoPassword nome="conferma_password" etichetta="Ripeti la nuova password" obbligatorio autoComplete="new-password"
          errore={stato.errori?.conferma_password} />
      </div>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio variante="secondary" inCorso="Salvataggio…">
        Cambia password
      </PulsanteInvio>
    </form>
  );
}

export function FormMarketing({ accettato }: { accettato: boolean }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(salvaConsensoMarketing, {});
  return (
    <form action={azione} className="space-y-4">
      <Casella nome="accetto_marketing" selezionata={accettato}>
        Desidero ricevere via email promozioni e novità sui prodotti di Sagè Pharma e Bioeleva.
      </Casella>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio variante="secondary" inCorso="Salvataggio…">
        Salva la preferenza
      </PulsanteInvio>
    </form>
  );
}
