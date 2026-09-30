"use client";

import { useActionState } from "react";
import { Campo, Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { salvaImpostazioni } from "./azioni";

export function FormImpostazioni({ iniziali }: { iniziali: Record<string, string> }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(salvaImpostazioni, {});
  const v = stato.valori ?? iniziali;
  const e = stato.errori ?? {};
  return (
    <form action={azione} className="space-y-8" noValidate>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Prenotazioni e consegne</legend>
        <Campo nome="giorni_validita_prenotazione" etichetta="Giorni lavorativi per confermare una prenotazione" valore={v.giorni_validita_prenotazione}
          errore={e.giorni_validita_prenotazione} inputMode="numeric" aiuto="Dopo questi giorni la prenotazione scade e la merce torna disponibile" />
        <Campo nome="giorni_consegna_indicativi" etichetta="Consegna indicativa (giorni lavorativi)" valore={v.giorni_consegna_indicativi}
          errore={e.giorni_consegna_indicativi} inputMode="numeric" aiuto="Mostrata nel carrello e nelle condizioni: non è un termine garantito" />
        <Campo nome="soglia_minima_ordine" etichetta="Ordine minimo farmacie (€ IVA esclusa)" valore={v.soglia_minima_ordine}
          errore={e.soglia_minima_ordine} aiuto="Vuoto = nessun minimo" />
        <Campo nome="soglia_esaurimento_default" etichetta="Soglia «In esaurimento» (pezzi)" valore={v.soglia_esaurimento_default}
          errore={e.soglia_esaurimento_default} inputMode="numeric" aiuto="Si può cambiare anche sul singolo prodotto" />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Invio al deposito</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="modalita_invio_deposito" className="etichetta">Modalità di invio</label>
            <select id="modalita_invio_deposito" name="modalita_invio_deposito" defaultValue={v.modalita_invio_deposito} className="select">
              <option value="singola">Singola: pulsante «Invia al deposito» su ogni ordine</option>
              <option value="cumulativa">Cumulativa: un&apos;email al giorno per deposito all&apos;orario indicato</option>
            </select>
          </div>
          <Campo nome="orario_invio_cumulativo" etichetta="Orario dell'invio cumulativo" tipo="time" valore={v.orario_invio_cumulativo} errore={e.orario_invio_cumulativo} />
          <Campo nome="ore_sollecito_ddt" etichetta="Sollecito se manca il DDT dopo (ore)" valore={v.ore_sollecito_ddt} errore={e.ore_sollecito_ddt} inputMode="numeric" />
        </div>
        <Casella nome="prezzi_in_richiesta_evasione" selezionata={v.prezzi_in_richiesta_evasione === "on"}>
          Includi i prezzi nella richiesta di evasione al deposito
        </Casella>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Notifiche e regole avanzate</legend>
        <Campo nome="email_notifiche_admin" etichetta="Email per gli avvisi all'amministrazione" valore={v.email_notifiche_admin} errore={e.email_notifiche_admin}
          aiuto="Nuove iscrizioni, nuovi ordini, solleciti DDT. Più indirizzi separati da virgola; vuoto = tutti gli amministratori" />
        <Campo nome="mesi_non_vendibile" etichetta="Lotti non vendibili sotto (mesi di scadenza)" valore={v.mesi_non_vendibile} errore={e.mesi_non_vendibile}
          inputMode="numeric" aiuto="Predisposta, di norma vuota: se indicata, i lotti con scadenza più vicina non si vendono" />
        <Campo nome="mesi_conservazione_chat" etichetta="Conservazione delle chat dell'assistente (mesi)" valore={v.mesi_conservazione_chat} errore={e.mesi_conservazione_chat}
          inputMode="numeric" aiuto="Dopo questo periodo conversazioni e domande senza risposta si cancellano da sole (da 1 a 120 mesi)" />
      </fieldset>

      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Salvataggio…">Salva le impostazioni</PulsanteInvio>
    </form>
  );
}
