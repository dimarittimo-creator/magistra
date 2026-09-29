"use client";

import Link from "next/link";
import { useActionState } from "react";
import { EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { annullaImport, confermaImport } from "../../azioni";

export function ConfermaImport({ id, bloccanti }: { id: string; bloccanti: number }) {
  const [stato, conferma] = useActionState<StatoModulo>(() => confermaImport(id), {});
  if (stato.ok) {
    return (
      <div className="space-y-3">
        <EsitoModulo ok messaggio={stato.messaggio} />
        <Link href="/admin/magazzino" className="btn btn-secondary">Torna al magazzino</Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {bloccanti > 0 && (
        <p className="avviso avviso-attenzione">
          Ci sono avvisi in rosso: puoi applicare lo stesso, ma controlla prima gli ordini aperti indicati.
        </p>
      )}
      <EsitoModulo messaggio={stato.messaggio} />
      <div className="flex flex-wrap gap-3">
        <form action={conferma}>
          <PulsanteInvio inCorso="Applicazione in corso…">Applica l&apos;import</PulsanteInvio>
        </form>
        <form action={annullaImport.bind(null, id)}>
          <button type="submit" className="btn btn-secondary">Annulla</button>
        </form>
      </div>
    </div>
  );
}
