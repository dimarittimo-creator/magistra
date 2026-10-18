"use client";

import { useActionState } from "react";
import { CampiMedico } from "@/components/CampiMedico";
import { CampoPassword, Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { cambiaPasswordMedico, salvaMarketingMedico, salvaProfiloMedico } from "./azioni";

export function FormProfiloMedico({ valoriIniziali }: { valoriIniziali: Record<string, string> }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(salvaProfiloMedico, {});
  // I campi bloccati non vengono inviati: si mostrano sempre dai dati salvati.
  const v = valoriIniziali;
  const valori = { ...v, ...stato.valori, nome: v.nome, cognome: v.cognome, numero_iscrizione: v.numero_iscrizione, ordine_provincia: v.ordine_provincia };
  return (
    <form action={azione} className="space-y-6" noValidate>
      <CampiMedico identificativi="bloccati" valori={valori} errori={stato.errori} />
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Salvataggio…">Salva i dati</PulsanteInvio>
    </form>
  );
}

export function FormPasswordMedico() {
  const [stato, azione] = useActionState<StatoModulo, FormData>(cambiaPasswordMedico, {});
  return (
    <form action={azione} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoPassword nome="password" etichetta="Nuova password" obbligatorio autoComplete="new-password"
          errore={stato.errori?.password} aiuto="Almeno 8 caratteri, con lettere e numeri" />
        <CampoPassword nome="conferma_password" etichetta="Ripeta la nuova password" obbligatorio autoComplete="new-password"
          errore={stato.errori?.conferma_password} />
      </div>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio variante="secondary" inCorso="Salvataggio…">Cambia password</PulsanteInvio>
    </form>
  );
}

export function FormMarketingMedico({ accettato }: { accettato: boolean }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(salvaMarketingMedico, {});
  return (
    <form action={azione} className="space-y-4">
      <Casella nome="accetto_marketing" selezionata={accettato}>
        Desidero ricevere via email novità scientifiche e sui prodotti di Sagè Pharma e Bioeleva.
      </Casella>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio variante="secondary" inCorso="Salvataggio…">Salva la preferenza</PulsanteInvio>
    </form>
  );
}
