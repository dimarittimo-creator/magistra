"use client";

import { useActionState, useState } from "react";
import { Campo, Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { TIPI_SEDE, type TipoSede } from "@/lib/sedi";
import { salvaSede } from "./azioni";

type Opzione = { id: string; nome: string };

export function FormSede({
  id,
  iniziali,
  societa,
  operatori,
}: {
  id: string | null;
  iniziali: Record<string, string>;
  societa: Opzione[];
  operatori: Opzione[];
}) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(salvaSede.bind(null, id), {});
  const v = stato.valori ?? iniziali;
  const e = stato.errori ?? {};
  const spunta = (nome: string) => v[nome] === "on";
  const [tipo, setTipo] = useState<TipoSede>((iniziali.tipo as TipoSede) || "deposito");
  const deposito = tipo === "deposito";

  return (
    <form action={azione} className="space-y-8" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="societa_id" className="etichetta">Società <span className="text-danger" aria-hidden="true">*</span></label>
          <select id="societa_id" name="societa_id" defaultValue={v.societa_id} className="select" aria-invalid={e.societa_id ? true : undefined} required>
            <option value="">Scegli…</option>
            {societa.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
          {e.societa_id && <p className="errore-campo">{e.societa_id}</p>}
        </div>
        <div>
          <label htmlFor="tipo" className="etichetta">Tipo <span className="text-danger" aria-hidden="true">*</span></label>
          <select id="tipo" name="tipo" value={tipo} onChange={(ev) => setTipo(ev.target.value as TipoSede)} className="select">
            {Object.entries(TIPI_SEDE).map(([valore, testo]) => (
              <option key={valore} value={valore}>{testo}</option>
            ))}
          </select>
          {tipo === "operativa" && (
            <p className="aiuto">Le sedi operative non sono luoghi di partenza della merce e non compaiono sui DDT.</p>
          )}
        </div>
        <Campo nome="nome" etichetta="Nome" obbligatorio className="sm:col-span-2" valore={v.nome} errore={e.nome}
          aiuto="Come comparirà nel portale (es. Deposito CIENNE)" />
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-6">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Indirizzo</legend>
        <Campo nome="indirizzo" etichetta="Via e numero civico" obbligatorio className="sm:col-span-6" valore={v.indirizzo} errore={e.indirizzo} />
        <Campo nome="cap" etichetta="CAP" obbligatorio className="sm:col-span-1" maxLength={5} valore={v.cap} errore={e.cap} />
        <Campo nome="citta" etichetta="Città" obbligatorio className="sm:col-span-4" valore={v.citta} errore={e.citta} />
        <Campo nome="provincia" etichetta="Provincia" obbligatorio className="sm:col-span-1" maxLength={2} maiuscolo valore={v.provincia} errore={e.provincia} />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-xl font-serif text-magistra-blu mb-2">Contatti</legend>
        <Campo nome="email" etichetta={deposito ? "Email per le richieste di evasione" : "Email"} tipo="email"
          obbligatorio={deposito} valore={v.email} errore={e.email} />
        <Campo nome="telefono" etichetta="Telefono" tipo="tel" valore={v.telefono} />
        <Campo nome="email_cc" etichetta="Email in copia" className="sm:col-span-2" valore={v.email_cc} errore={e.email_cc}
          aiuto="Separa più indirizzi con una virgola" />
        <Campo nome="referente" etichetta="Referente" valore={v.referente} />
        <Campo nome="orari" etichetta="Orari" valore={v.orari} />
      </fieldset>

      {deposito && (
        <fieldset className="space-y-4">
          <legend className="text-xl font-serif text-magistra-blu mb-2">Deposito</legend>
          <div className="sm:w-1/2">
            <label htmlFor="operatore_id" className="etichetta">Operatore logistico</label>
            <select id="operatore_id" name="operatore_id" defaultValue={v.operatore_id} className="select">
              <option value="">Nessuno</option>
              {operatori.map((o) => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>
          <Casella nome="predefinito" selezionata={spunta("predefinito")} errore={e.predefinito}>
            Deposito predefinito (usato per i nuovi ordini e per i file di giacenza)
          </Casella>
        </fieldset>
      )}

      <Casella nome="attiva" selezionata={id ? spunta("attiva") : true}>
        Sede attiva (una sede disattivata resta nello storico degli ordini)
      </Casella>

      <div>
        <label htmlFor="note" className="etichetta">Note</label>
        <textarea id="note" name="note" rows={2} defaultValue={v.note} className="textarea" />
      </div>

      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Salvataggio…">{id ? "Salva le modifiche" : "Crea la sede"}</PulsanteInvio>
    </form>
  );
}
