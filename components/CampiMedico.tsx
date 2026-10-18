import { Campo } from "@/components/moduli";

// Campi del medico: iscrizione (dati identificativi modificabili), profilo e admin.
export function CampiMedico({
  valori = {},
  errori = {},
  identificativi,
}: {
  valori?: Record<string, string | undefined>;
  errori?: Record<string, string>;
  identificativi: "modificabili" | "bloccati";
}) {
  const bloccati = identificativi === "bloccati";
  return (
    <div className="space-y-8">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-xl font-serif text-magistra-blu mb-2">I tuoi dati</legend>
        <Campo nome="nome" etichetta="Nome" obbligatorio={!bloccati} disabilitato={bloccati} valore={valori.nome} errore={errori.nome} autoComplete="given-name" />
        <Campo nome="cognome" etichetta="Cognome" obbligatorio={!bloccati} disabilitato={bloccati} valore={valori.cognome} errore={errori.cognome} autoComplete="family-name" />
        <Campo nome="specializzazione" etichetta="Specializzazione" obbligatorio valore={valori.specializzazione} errore={errori.specializzazione}
          aiuto="Es. Medicina generale, Ginecologia, Neurologia" />
        <Campo nome="telefono" etichetta="Telefono" tipo="tel" obbligatorio valore={valori.telefono} errore={errori.telefono} autoComplete="tel" inputMode="tel" />
        <Campo nome="email" etichetta={bloccati ? "Email per le comunicazioni" : "Email"} tipo="email" obbligatorio valore={valori.email} errore={errori.email}
          autoComplete="email" inputMode="email" className="sm:col-span-2" />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-6">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Iscrizione all&apos;Ordine dei Medici</legend>
        <Campo nome="numero_iscrizione" etichetta="Numero di iscrizione" obbligatorio={!bloccati} disabilitato={bloccati} className="sm:col-span-3"
          valore={valori.numero_iscrizione} errore={errori.numero_iscrizione} maxLength={20}
          aiuto={bloccati ? "Per correggerlo scrivi all'assistenza" : "Lo verifichiamo prima di attivare l'accesso"} />
        <Campo nome="ordine_provincia" etichetta="Provincia dell'Ordine" obbligatorio={!bloccati} disabilitato={bloccati} className="sm:col-span-3"
          valore={valori.ordine_provincia} errore={errori.ordine_provincia} maxLength={2} maiuscolo aiuto="Sigla, es. NA" />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-6">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Studio o struttura</legend>
        <p className="aiuto sm:col-span-6 -mt-2">È anche l&apos;indirizzo a cui spediamo i campioni.</p>
        <Campo nome="struttura" etichetta="Nome dello studio o della struttura (facoltativo)" className="sm:col-span-6" valore={valori.struttura} errore={errori.struttura} />
        <Campo nome="studio_indirizzo" etichetta="Via e numero civico" obbligatorio className="sm:col-span-4" valore={valori.studio_indirizzo} errore={errori.studio_indirizzo}
          autoComplete="street-address" />
        <Campo nome="studio_presso" etichetta="Presso / piano / interno" className="sm:col-span-2" valore={valori.studio_presso} />
        <Campo nome="studio_cap" etichetta="CAP" obbligatorio className="sm:col-span-1" maxLength={5} inputMode="numeric" valore={valori.studio_cap} errore={errori.studio_cap}
          autoComplete="postal-code" />
        <Campo nome="studio_citta" etichetta="Città" obbligatorio className="sm:col-span-4" valore={valori.studio_citta} errore={errori.studio_citta} autoComplete="address-level2" />
        <Campo nome="studio_provincia" etichetta="Provincia" obbligatorio className="sm:col-span-1" maxLength={2} maiuscolo valore={valori.studio_provincia}
          errore={errori.studio_provincia} autoComplete="address-level1" />
      </fieldset>
    </div>
  );
}
