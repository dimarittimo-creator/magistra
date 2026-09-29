"use client";

import { useActionState } from "react";
import { Campo, Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { salvaSocieta } from "../azioni";

export function FormSocieta({ id, iniziali }: { id: string; iniziali: Record<string, string> }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(salvaSocieta.bind(null, id), {});
  const v = stato.valori ? { ...stato.valori } : iniziali;
  const e = stato.errori ?? {};
  const spunta = (nome: string) => (stato.valori ? stato.valori[nome] === "on" : iniziali[nome] === "on");

  return (
    <form action={azione} className="space-y-8" noValidate>
      <fieldset className="space-y-4">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Dati societari</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo nome="ragione_sociale" etichetta="Ragione sociale" obbligatorio valore={v.ragione_sociale} errore={e.ragione_sociale} />
          <Campo nome="nome_breve" etichetta="Nome breve (nel portale)" obbligatorio valore={v.nome_breve} errore={e.nome_breve} />
          <Campo nome="partita_iva" etichetta="Partita IVA" obbligatorio valore={v.partita_iva} errore={e.partita_iva} inputMode="numeric" />
          <Campo nome="codice_fiscale" etichetta="Codice fiscale" obbligatorio valore={v.codice_fiscale} errore={e.codice_fiscale} maiuscolo />
          <Campo nome="rea" etichetta="REA" valore={v.rea} />
          <Campo nome="capitale_sociale_testo" etichetta="Capitale sociale" valore={v.capitale_sociale_testo}
            aiuto="Testo libero, come deve comparire sui documenti (es. € 100.000,00 i.v.)" />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Sede legale</legend>
        <div className="grid gap-4 sm:grid-cols-6">
          <Campo nome="sede_legale_indirizzo" etichetta="Indirizzo" obbligatorio className="sm:col-span-6"
            valore={v.sede_legale_indirizzo} errore={e.sede_legale_indirizzo} />
          <Campo nome="sede_legale_cap" etichetta="CAP" obbligatorio className="sm:col-span-1" maxLength={5}
            valore={v.sede_legale_cap} errore={e.sede_legale_cap} />
          <Campo nome="sede_legale_citta" etichetta="Città" obbligatorio className="sm:col-span-4"
            valore={v.sede_legale_citta} errore={e.sede_legale_citta} />
          <Campo nome="sede_legale_provincia" etichetta="Provincia" obbligatorio className="sm:col-span-1" maxLength={2} maiuscolo
            valore={v.sede_legale_provincia} errore={e.sede_legale_provincia} />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Fatturazione, contatti e pagamenti</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo nome="sdi" etichetta="Codice SDI" valore={v.sdi} errore={e.sdi} maiuscolo maxLength={7} />
          <Campo nome="pec" etichetta="PEC" tipo="email" valore={v.pec} errore={e.pec} />
          <Campo nome="email" etichetta="Email amministrazione" tipo="email" valore={v.email} errore={e.email} />
          <Campo nome="telefono" etichetta="Telefono" tipo="tel" valore={v.telefono} />
          <Campo nome="sito" etichetta="Sito" valore={v.sito} />
          <Campo nome="iban" etichetta="IBAN per bonifico" valore={v.iban} errore={e.iban} maiuscolo
            aiuto="Controllato automaticamente: un IBAN non valido non si salva. Senza IBAN il bonifico non è proponibile per questa società." />
        </div>
        <div>
          <label htmlFor="piede_documenti" className="etichetta">Piè di pagina dei documenti</label>
          <textarea id="piede_documenti" name="piede_documenti" rows={2} defaultValue={v.piede_documenti} className="textarea" />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Utilizzo nel portale</legend>
        <Casella nome="attiva" selezionata={spunta("attiva")}>Società attiva</Casella>
        <Casella nome="attiva_farmacie" selezionata={spunta("attiva_farmacie")}>Selezionabile negli ordini delle farmacie</Casella>
        <Casella nome="attiva_privati" selezionata={spunta("attiva_privati")}>Selezionabile negli ordini dei privati</Casella>
        <Casella nome="predefinita" selezionata={spunta("predefinita")} errore={e.predefinita}>
          Società predefinita (preselezionata nel carrello)
        </Casella>
      </fieldset>

      <div>
        <label htmlFor="note" className="etichetta">Note interne</label>
        <textarea id="note" name="note" rows={2} defaultValue={v.note} className="textarea" />
      </div>

      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Salvataggio…">Salva le modifiche</PulsanteInvio>
    </form>
  );
}
