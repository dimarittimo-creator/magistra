"use client";

import { useActionState } from "react";
import { Campo, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { cambiaAttivazione, salvaSpeseEregole } from "./azioni";

export function FormSpese({ iniziali }: { iniziali: Record<string, string> }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(salvaSpeseEregole, {});
  const v = stato.valori ?? iniziali;
  const e = stato.errori ?? {};
  return (
    <form action={azione} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo nome="importo" etichetta="Spese di spedizione (€, IVA inclusa)" valore={v.importo} errore={e.importo} aiuto="Vuoto = non ancora indicate" />
        <Campo nome="soglia_gratuita" etichetta="Spedizione gratuita da (€)" valore={v.soglia_gratuita} errore={e.soglia_gratuita} aiuto="Sul totale prodotti; vuoto = mai gratuita" />
        <Campo nome="iva" etichetta="IVA sulle spese (%)" valore={v.iva} errore={e.iva} />
        <Campo nome="mesi_minimi_lotto_privati" etichetta="Vita residua minima dei lotti per i privati (mesi)" valore={v.mesi_minimi_lotto_privati}
          errore={e.mesi_minimi_lotto_privati} inputMode="numeric" className="sm:col-span-3" aiuto="I lotti con scadenza più vicina restano alle farmacie" />
      </div>
      <p className="aiuto">Il costo aggiuntivo del contrassegno si imposta in Pagamenti, sulla modalità «Contrassegno».</p>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Salvataggio…">Salva</PulsanteInvio>
    </form>
  );
}

export function Attivazione({ attiva }: { attiva: boolean }) {
  const [stato, azione] = useActionState<StatoModulo>(() => cambiaAttivazione(!attiva), {});
  return (
    <form action={azione} className="space-y-3">
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio variante={attiva ? "secondary" : "primary"} inCorso="…">
        {attiva ? "Disattiva l'area Privati online" : "Attiva l'area Privati online"}
      </PulsanteInvio>
    </form>
  );
}
