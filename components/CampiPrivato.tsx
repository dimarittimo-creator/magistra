"use client";

import { useState } from "react";
import { Campo, Casella } from "@/components/moduli";

// Campi del cliente privato: registrazione (anagrafica modificabile) e profilo (anagrafica bloccata).
export function CampiPrivato({
  valori = {},
  errori = {},
  anagrafica,
}: {
  valori?: Record<string, string | undefined>;
  errori?: Record<string, string>;
  anagrafica: "modificabile" | "bloccata";
}) {
  const bloccata = anagrafica === "bloccata";
  const diversa = valori.fatturazione_uguale === undefined ? false : valori.fatturazione_uguale !== "on";
  const [uguale, setUguale] = useState(!diversa);
  return (
    <div className="space-y-8">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-xl font-serif text-magistra-blu mb-2">I tuoi dati</legend>
        <Campo nome="nome" etichetta="Nome" obbligatorio={!bloccata} disabilitato={bloccata} valore={valori.nome} errore={errori.nome} autoComplete="given-name" />
        <Campo nome="cognome" etichetta="Cognome" obbligatorio={!bloccata} disabilitato={bloccata} valore={valori.cognome} errore={errori.cognome} autoComplete="family-name" />
        <Campo nome="codice_fiscale" etichetta="Codice fiscale" obbligatorio={!bloccata} disabilitato={bloccata} valore={valori.codice_fiscale} errore={errori.codice_fiscale}
          maiuscolo maxLength={16} aiuto={bloccata ? "Per correggerlo scrivi all'assistenza" : "Serve per la fattura"} />
        <Campo nome="telefono" etichetta="Telefono" tipo="tel" obbligatorio valore={valori.telefono} errore={errori.telefono} autoComplete="tel" inputMode="tel"
          aiuto="Per il corriere" />
        <Campo nome="email" etichetta={bloccata ? "Email per le comunicazioni" : "Email"} tipo="email" obbligatorio valore={valori.email} errore={errori.email}
          autoComplete="email" inputMode="email" className="sm:col-span-2" />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-6">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Indirizzo di spedizione</legend>
        <Indirizzo prefisso="consegna" valori={valori} errori={errori} />
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Indirizzo di fatturazione</legend>
        <Casella nome="fatturazione_uguale" selezionata={uguale} onChange={setUguale}>Uguale all&apos;indirizzo di spedizione</Casella>
        {!uguale && <div className="grid gap-4 sm:grid-cols-6"><Indirizzo prefisso="fatturazione" valori={valori} errori={errori} /></div>}
      </fieldset>
    </div>
  );
}

function Indirizzo({ prefisso, valori, errori }: { prefisso: string; valori: Record<string, string | undefined>; errori: Record<string, string> }) {
  const auto = prefisso === "consegna" ? "shipping" : "billing";
  return (
    <>
      <Campo nome={`${prefisso}_indirizzo`} etichetta="Via e numero civico" obbligatorio className="sm:col-span-4" valore={valori[`${prefisso}_indirizzo`]} errore={errori[`${prefisso}_indirizzo`]} autoComplete={`${auto} street-address`} />
      <Campo nome={`${prefisso}_presso`} etichetta="Presso / scala / interno" className="sm:col-span-2" valore={valori[`${prefisso}_presso`]} />
      <Campo nome={`${prefisso}_cap`} etichetta="CAP" obbligatorio className="sm:col-span-1" maxLength={5} inputMode="numeric" valore={valori[`${prefisso}_cap`]} errore={errori[`${prefisso}_cap`]} autoComplete={`${auto} postal-code`} />
      <Campo nome={`${prefisso}_citta`} etichetta="Città" obbligatorio className="sm:col-span-4" valore={valori[`${prefisso}_citta`]} errore={errori[`${prefisso}_citta`]} autoComplete={`${auto} address-level2`} />
      <Campo nome={`${prefisso}_provincia`} etichetta="Provincia" obbligatorio className="sm:col-span-1" maxLength={2} maiuscolo valore={valori[`${prefisso}_provincia`]} errore={errori[`${prefisso}_provincia`]} autoComplete={`${auto} address-level1`} />
    </>
  );
}
