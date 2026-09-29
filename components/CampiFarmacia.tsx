"use client";

import { useState } from "react";
import { Campo, Casella } from "@/components/moduli";

// Campi anagrafici e indirizzi della farmacia, usati da iscrizione, profilo e area admin.
// identificativi: "modificabili" (iscrizione, admin) oppure "bloccati" (profilo della farmacia).

type Props = {
  valori?: Record<string, string | undefined>;
  errori?: Record<string, string>;
  identificativi: "modificabili" | "bloccati";
  etichettaEmail?: string;
  aiutoEmail?: string;
};

export function CampiFarmacia({ valori = {}, errori = {}, identificativi, etichettaEmail, aiutoEmail }: Props) {
  const fatturazioneDiversa =
    valori.fatturazione_uguale === undefined
      ? Boolean(valori.fatturazione_indirizzo && valori.fatturazione_indirizzo !== valori.consegna_indirizzo)
      : valori.fatturazione_uguale !== "on";
  const [uguale, setUguale] = useState(!fatturazioneDiversa);
  const bloccati = identificativi === "bloccati";

  return (
    <div className="space-y-8">
      <fieldset className="space-y-4">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Dati della farmacia</legend>
        {bloccati && (
          <p className="aiuto">
            Ragione sociale, partita IVA, codice fiscale e codice farmacia possono essere modificati solo
            dall&apos;amministrazione Magistra: scrivici se devono essere corretti.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo nome="ragione_sociale" etichetta="Ragione sociale" obbligatorio={!bloccati} disabilitato={bloccati}
            valore={valori.ragione_sociale} errore={errori.ragione_sociale} autoComplete="organization" className="sm:col-span-2" />
          <Campo nome="partita_iva" etichetta="Partita IVA" obbligatorio={!bloccati} disabilitato={bloccati}
            valore={valori.partita_iva} errore={errori.partita_iva} inputMode="numeric" maxLength={13} />
          <Campo nome="codice_fiscale" etichetta="Codice fiscale" disabilitato={bloccati} maiuscolo
            valore={valori.codice_fiscale} errore={errori.codice_fiscale} maxLength={16}
            aiuto={bloccati ? undefined : "Lascia vuoto se coincide con la partita IVA"} />
          <Campo nome="codice_farmacia" etichetta="Codice identificativo farmacia" obbligatorio={!bloccati} disabilitato={bloccati}
            valore={valori.codice_farmacia} errore={errori.codice_farmacia} maiuscolo maxLength={20}
            aiuto={bloccati ? undefined : "Il codice assegnato alla farmacia dal Ministero della Salute / ASL"} />
          <Campo nome="titolare" etichetta="Titolare" obbligatorio valore={valori.titolare} errore={errori.titolare} autoComplete="name" />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Fatturazione elettronica e contatti</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo nome="sdi" etichetta="Codice destinatario SDI" valore={valori.sdi} errore={errori.sdi} maiuscolo maxLength={7}
            aiuto="7 caratteri. Obbligatorio il codice SDI oppure la PEC" />
          <Campo nome="pec" etichetta="PEC" tipo="email" valore={valori.pec} errore={errori.pec} inputMode="email" />
          <Campo nome="email" etichetta={etichettaEmail ?? "Email"} tipo="email" obbligatorio valore={valori.email} errore={errori.email}
            autoComplete="email" inputMode="email" aiuto={aiutoEmail} />
          <Campo nome="telefono" etichetta="Telefono" tipo="tel" obbligatorio valore={valori.telefono} errore={errori.telefono}
            autoComplete="tel" inputMode="tel" />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Indirizzo di consegna</legend>
        <CampiIndirizzo prefisso="consegna" valori={valori} errori={errori} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Indirizzo di fatturazione</legend>
        <Casella nome="fatturazione_uguale" selezionata={uguale} onChange={setUguale}>
          Uguale all&apos;indirizzo di consegna
        </Casella>
        {!uguale && <CampiIndirizzo prefisso="fatturazione" valori={valori} errori={errori} />}
      </fieldset>
    </div>
  );
}

function CampiIndirizzo({
  prefisso,
  valori,
  errori,
}: {
  prefisso: "consegna" | "fatturazione";
  valori: Record<string, string | undefined>;
  errori: Record<string, string>;
}) {
  const tipoAuto = prefisso === "consegna" ? "shipping" : "billing";
  return (
    <div className="grid gap-4 sm:grid-cols-6">
      <Campo nome={`${prefisso}_indirizzo`} etichetta="Via e numero civico" obbligatorio className="sm:col-span-4"
        valore={valori[`${prefisso}_indirizzo`]} errore={errori[`${prefisso}_indirizzo`]} autoComplete={`${tipoAuto} street-address`} />
      <Campo nome={`${prefisso}_presso`} etichetta="Presso (facoltativo)" className="sm:col-span-2"
        valore={valori[`${prefisso}_presso`]} />
      <Campo nome={`${prefisso}_cap`} etichetta="CAP" obbligatorio className="sm:col-span-1" inputMode="numeric" maxLength={5}
        valore={valori[`${prefisso}_cap`]} errore={errori[`${prefisso}_cap`]} autoComplete={`${tipoAuto} postal-code`} />
      <Campo nome={`${prefisso}_citta`} etichetta="Città" obbligatorio className="sm:col-span-4"
        valore={valori[`${prefisso}_citta`]} errore={errori[`${prefisso}_citta`]} autoComplete={`${tipoAuto} address-level2`} />
      <Campo nome={`${prefisso}_provincia`} etichetta="Provincia" obbligatorio className="sm:col-span-1" maiuscolo maxLength={2}
        valore={valori[`${prefisso}_provincia`]} errore={errori[`${prefisso}_provincia`]} autoComplete={`${tipoAuto} address-level1`} />
    </div>
  );
}
