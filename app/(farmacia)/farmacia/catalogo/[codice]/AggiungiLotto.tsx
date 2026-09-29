"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { aggiungiAlCarrello } from "../../carrello/azioni";

export function AggiungiLotto({
  lottoId,
  codiceLotto,
  massimo,
  minimo,
  variante,
}: {
  lottoId: string;
  codiceLotto: string;
  massimo: number;
  minimo: number;
  /** La scheda compare in tabella (computer) e in elenco (smartphone): id distinti. */
  variante: "tabella" | "elenco";
}) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(aggiungiAlCarrello.bind(null, lottoId), {});
  const id = `quantita-${variante}-${lottoId}`;
  return (
    <form action={azione} className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="sr-only">
          Quantità lotto {codiceLotto}
        </label>
        <input
          id={id}
          name="quantita"
          type="number"
          inputMode="numeric"
          min={1}
          max={massimo}
          defaultValue={minimo}
          required
          className="input w-24 text-right"
        />
        <PulsanteInvio inCorso="…" className="btn-piccolo whitespace-nowrap">
          Aggiungi
        </PulsanteInvio>
      </div>
      {stato.messaggio && (
        <p role={stato.ok ? "status" : "alert"} className={`text-sm ${stato.ok ? "text-slate" : "text-danger font-semibold"}`}>
          {stato.messaggio} {stato.ok && <Link href="/farmacia/carrello">Vai al carrello</Link>}
        </p>
      )}
    </form>
  );
}
