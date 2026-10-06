"use client";

import { useActionState } from "react";
import type { StatoModulo } from "@/lib/farmacie/dati";

// Riquadro per il cliente: accettare o rifiutare le modifiche dell'amministrazione (condizioni di vendita art. 4.3).
export function AccettaModifiche({
  accetta,
  rifiuta,
  nota,
  scadenza,
}: {
  accetta: (prima: StatoModulo) => Promise<StatoModulo>;
  rifiuta: (prima: StatoModulo) => Promise<StatoModulo>;
  nota: string | null;
  scadenza: string | null;
}) {
  const [esitoSi, azioneSi, inCorsoSi] = useActionState<StatoModulo>(accetta, {});
  const [esitoNo, azioneNo, inCorsoNo] = useActionState<StatoModulo>(rifiuta, {});
  const esito = esitoSi.messaggio ? esitoSi : esitoNo;
  const occupato = inCorsoSi || inCorsoNo;
  return (
    <section className="avviso avviso-attenzione space-y-3" aria-labelledby="t-modifiche">
      <h2 id="t-modifiche" className="text-xl font-serif text-magistra-blu">Abbiamo modificato questo ordine</h2>
      <p>
        Qui sotto trovi il riepilogo aggiornato. Come previsto dalle condizioni di vendita (art. 4.3), <strong>le modifiche valgono solo se le accetti</strong>:
        finché non rispondi l&apos;ordine non viene spedito.
        {scadenza && <> Se non rispondi entro il {scadenza}, l&apos;ordine scade e la merce torna disponibile.</>}
      </p>
      {nota && (
        <p>
          <strong>Nota dell&apos;amministrazione:</strong> {nota}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <form action={azioneSi}>
          <button type="submit" className="btn btn-primary" disabled={occupato}>
            {inCorsoSi ? "Conferma in corso…" : "Accetto le modifiche"}
          </button>
        </form>
        <form
          action={azioneNo}
          onSubmit={(ev) => {
            if (!window.confirm("Se non accetti le modifiche l'ordine viene chiuso e non sarà spedito. Confermi?")) ev.preventDefault();
          }}
        >
          <button type="submit" className="btn btn-secondary" disabled={occupato}>
            {inCorsoNo ? "Operazione in corso…" : "Non accetto"}
          </button>
        </form>
      </div>
      {esito.messaggio && (
        <p role={esito.ok ? "status" : "alert"} className={`avviso ${esito.ok ? "avviso-ok" : "avviso-errore"}`}>
          {esito.messaggio}
        </p>
      )}
    </section>
  );
}
