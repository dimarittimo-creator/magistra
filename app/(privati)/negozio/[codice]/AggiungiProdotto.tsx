"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { aggiungiProdotto } from "../carrello/azioni";

export function AggiungiProdotto({ codice }: { codice: string }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(aggiungiProdotto.bind(null, codice), {});
  return (
    <form action={azione} className="space-y-3">
      <div className="flex items-end gap-3">
        <div>
          <label htmlFor="quantita" className="etichetta">Quantità</label>
          <select id="quantita" name="quantita" defaultValue="1" className="select w-24">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <PulsanteInvio inCorso="Aggiunta…" className="flex-1">Aggiungi al carrello</PulsanteInvio>
      </div>
      {stato.messaggio && (
        <p role={stato.ok ? "status" : "alert"} className={`text-sm ${stato.ok ? "text-slate font-semibold" : "text-danger font-semibold"}`}>
          {stato.messaggio} {stato.ok && <Link href="/negozio/carrello">Vai al carrello</Link>}
        </p>
      )}
    </form>
  );
}
