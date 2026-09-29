"use client";

import { useActionState, useState } from "react";
import { CampiFarmacia } from "@/components/CampiFarmacia";
import { Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { approvaFarmacia, bloccaFarmacia, salvaCondizioniFarmacia, salvaDatiFarmaciaAdmin } from "../azioni";

export function AzioniStato({ id, stato }: { id: string; stato: "in_attesa" | "attiva" | "bloccata" }) {
  const [esitoApprova, approva] = useActionState<StatoModulo>(() => approvaFarmacia(id), {});
  const [esitoBlocca, blocca] = useActionState<StatoModulo, FormData>(bloccaFarmacia.bind(null, id), {});
  const [bloccoAperto, setBloccoAperto] = useState(false);
  const esito = esitoApprova.messaggio ? esitoApprova : esitoBlocca;

  return (
    <div className="space-y-4">
      <EsitoModulo ok={esito.ok} messaggio={esito.messaggio} />
      <div className="flex flex-wrap gap-3">
        {stato !== "attiva" && (
          <form action={approva}>
            <PulsanteInvio inCorso="Approvazione…">{stato === "bloccata" ? "Riattiva la farmacia" : "Approva l'iscrizione"}</PulsanteInvio>
          </form>
        )}
        {stato !== "bloccata" && !bloccoAperto && (
          <button type="button" className="btn btn-secondary" onClick={() => setBloccoAperto(true)}>
            {stato === "in_attesa" ? "Rifiuta l'iscrizione" : "Blocca la farmacia"}
          </button>
        )}
      </div>
      {stato !== "bloccata" && bloccoAperto && (
        <form action={blocca} className="space-y-4 border border-line rounded-lg p-4">
          <div>
            <label htmlFor="motivo_blocco" className="etichetta">
              Motivo (facoltativo, compare nell&apos;email alla farmacia)
            </label>
            <textarea id="motivo_blocco" name="motivo_blocco" rows={2} className="textarea" />
          </div>
          <Casella nome="avvisa" selezionata>
            Avvisa la farmacia via email
          </Casella>
          <div className="flex flex-wrap gap-3">
            <PulsanteInvio inCorso="Blocco…">Conferma il blocco</PulsanteInvio>
            <button type="button" className="btn btn-secondary" onClick={() => setBloccoAperto(false)}>
              Annulla
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function FormCondizioni({
  id,
  valori,
  gruppi,
  societa,
}: {
  id: string;
  valori: { gruppo_id: string; societa_predefinita_id: string; note_admin: string };
  gruppi: { id: string; nome: string; attivo: boolean }[];
  societa: { id: string; nome_breve: string; predefinita: boolean }[];
}) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(salvaCondizioniFarmacia.bind(null, id), {});
  const predefinita = societa.find((s) => s.predefinita)?.nome_breve;
  return (
    <form action={azione} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="gruppo_id" className="etichetta">Gruppo</label>
          <select id="gruppo_id" name="gruppo_id" defaultValue={valori.gruppo_id} className="select">
            <option value="">Nessun gruppo</option>
            {gruppi.map((g) => (
              <option key={g.id} value={g.id} disabled={!g.attivo && g.id !== valori.gruppo_id}>
                {g.nome}
                {!g.attivo ? " (non attivo)" : ""}
              </option>
            ))}
          </select>
          <p className="aiuto">I listini dedicati ai gruppi arriveranno con la gestione del magazzino.</p>
        </div>
        <div>
          <label htmlFor="societa_predefinita_id" className="etichetta">Società che fattura (predefinita)</label>
          <select id="societa_predefinita_id" name="societa_predefinita_id" defaultValue={valori.societa_predefinita_id} className="select">
            <option value="">Come da portale{predefinita ? ` (${predefinita})` : ""}</option>
            {societa.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome_breve}
              </option>
            ))}
          </select>
          <p className="aiuto">Precompila la scelta nel carrello; la farmacia può cambiarla in ogni ordine.</p>
        </div>
      </div>
      <div>
        <label htmlFor="note_admin" className="etichetta">Note interne (non visibili alla farmacia)</label>
        <textarea id="note_admin" name="note_admin" rows={3} defaultValue={valori.note_admin} className="textarea" />
      </div>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Salvataggio…">Salva</PulsanteInvio>
    </form>
  );
}

export function FormDatiAdmin({ id, valoriIniziali }: { id: string; valoriIniziali: Record<string, string> }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(salvaDatiFarmaciaAdmin.bind(null, id), {});
  return (
    <form action={azione} className="space-y-6" noValidate>
      <CampiFarmacia identificativi="modificabili" valori={{ ...valoriIniziali, ...stato.valori }} errori={stato.errori}
        etichettaEmail="Email per le comunicazioni" aiutoEmail="Non cambia l'email con cui la farmacia accede" />
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Salvataggio…">Salva i dati</PulsanteInvio>
    </form>
  );
}
