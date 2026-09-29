"use client";

import { useActionState, useState } from "react";
import { Campo, Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { salvaGruppo } from "./azioni";

export function NuovoGruppo() {
  const [stato, azione] = useActionState<StatoModulo, FormData>(salvaGruppo.bind(null, null), {});
  return (
    <form action={azione} className="grid gap-4 sm:grid-cols-[1fr_2fr_auto] items-start" key={stato.ok ? stato.messaggio : "nuovo"}>
      <Campo nome="nome" etichetta="Nome del gruppo" obbligatorio valore={stato.ok ? "" : stato.valori?.nome} errore={stato.errori?.nome} />
      <Campo nome="descrizione" etichetta="Descrizione (facoltativa)" valore={stato.ok ? "" : stato.valori?.descrizione} />
      <div className="sm:pt-7">
        <PulsanteInvio inCorso="Creazione…">Crea gruppo</PulsanteInvio>
      </div>
      <div className="sm:col-span-3">
        <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      </div>
    </form>
  );
}

export function RigaGruppo({
  gruppo,
}: {
  gruppo: { id: string; nome: string; descrizione: string | null; attivo: boolean; farmacie: number };
}) {
  const [modifica, setModifica] = useState(false);
  const [stato, azione] = useActionState<StatoModulo, FormData>(async (prima: StatoModulo, fd: FormData) => {
    const esito = await salvaGruppo(gruppo.id, prima, fd);
    if (esito.ok) setModifica(false);
    return esito;
  }, {});

  if (!modifica) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-line">
        <div>
          <p className="font-semibold">
            {gruppo.nome} {!gruppo.attivo && <span className="pill pill-off ml-2">Non attivo</span>}
          </p>
          {gruppo.descrizione && <p className="text-sm text-muted">{gruppo.descrizione}</p>}
          <p className="text-sm text-muted">
            {gruppo.farmacie === 1 ? "1 farmacia" : `${gruppo.farmacie} farmacie`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stato.ok && <span role="status" className="text-sm text-slate">{stato.messaggio}</span>}
          <button type="button" className="btn btn-secondary btn-piccolo" onClick={() => setModifica(true)}>
            Modifica
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="py-3 border-b border-line">
      <form action={azione} className="grid gap-4 sm:grid-cols-[1fr_2fr] items-start">
        <Campo nome="nome" etichetta="Nome" obbligatorio valore={stato.valori?.nome ?? gruppo.nome} errore={stato.errori?.nome} />
        <Campo nome="descrizione" etichetta="Descrizione" valore={gruppo.descrizione ?? ""} />
        <Casella nome="attivo" selezionata={gruppo.attivo}>
          Gruppo attivo (se lo disattivi non si può più assegnare a nuove farmacie)
        </Casella>
        <div className="flex gap-3 sm:justify-end">
          <PulsanteInvio inCorso="Salvataggio…" className="btn-piccolo">Salva</PulsanteInvio>
          <button type="button" className="btn btn-secondary btn-piccolo" onClick={() => setModifica(false)}>
            Annulla
          </button>
        </div>
        <div className="sm:col-span-2">
          <EsitoModulo messaggio={stato.ok ? undefined : stato.messaggio} />
        </div>
      </form>
    </li>
  );
}
