"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { ripetiOrdine } from "../azioni";

export function RipetiOrdine({ ordineId }: { ordineId: string }) {
  const [stato, azione] = useActionState<StatoModulo>(() => ripetiOrdine(ordineId), {});
  return (
    <form action={azione} className="flex flex-col items-end gap-2">
      <PulsanteInvio variante="secondary" inCorso="Aggiunta al carrello…">Ripeti ordine</PulsanteInvio>
      {stato.messaggio && (
        <p role={stato.ok ? "status" : "alert"} className={`text-sm max-w-md text-right ${stato.ok ? "" : "text-danger font-semibold"}`}>
          {stato.messaggio} {stato.ok && <Link href="/farmacia/carrello">Vai al carrello</Link>}
        </p>
      )}
    </form>
  );
}
