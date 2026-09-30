"use client";

import { useActionState } from "react";
import { Campo, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { salvaDocumento } from "../azioni";

type Documento = { id: string; titolo: string; tipo: string; pubblico: string; prodotto_codice: string | null; testo: string };

export function ModuloDocumento({ documento, tipi, pubblici }: { documento: Documento | null; tipi: Record<string, string>; pubblici: Record<string, string> }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(salvaDocumento.bind(null, documento?.id ?? null), {});
  const v = { ...(documento ?? {}), ...stato.valori } as Partial<Documento> & Record<string, string | null | undefined>;
  const errore = (n: string) => stato.errori?.[n];

  return (
    <form action={azione} className="space-y-4">
      <Campo nome="titolo" etichetta="Titolo" obbligatorio valore={v.titolo ?? ""} errore={errore("titolo")} maxLength={200} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="campo-tipo" className="etichetta">
            Tipo
          </label>
          <select id="campo-tipo" name="tipo" className="select" defaultValue={v.tipo ?? "scheda_prodotto"}>
            {Object.entries(tipi).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="campo-pubblico" className="etichetta">
            Destinatari
          </label>
          <select id="campo-pubblico" name="pubblico" className="select" defaultValue={v.pubblico ?? "tutti"}>
            {Object.entries(pubblici).map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <Campo nome="prodotto_codice" etichetta="Codice prodotto (facoltativo)" valore={v.prodotto_codice ?? ""} errore={errore("prodotto_codice")} maxLength={50} />
      </div>
      <div>
        <label htmlFor="campo-file" className="etichetta">
          Carica un file (facoltativo)
        </label>
        <input id="campo-file" name="file" type="file" accept=".pdf,.txt,.md" className="block" aria-describedby="campo-file-aiuto" />
        <p id="campo-file-aiuto" className="aiuto">
          PDF, TXT o MD fino a 5 MB: il testo del file sostituisce quello del riquadro qui sotto. Controllalo dopo il salvataggio.
        </p>
        {errore("file") && <p className="errore-campo">{errore("file")}</p>}
      </div>
      <div>
        <label htmlFor="campo-testo" className="etichetta">
          Testo
        </label>
        <textarea
          id="campo-testo"
          name="testo"
          rows={18}
          className="textarea font-mono text-sm"
          defaultValue={v.testo ?? ""}
          aria-invalid={errore("testo") ? true : undefined}
          aria-describedby="campo-testo-aiuto"
          key={stato.valori?.testo?.length ?? documento?.testo.length ?? 0}
        />
        <p id="campo-testo-aiuto" className="aiuto">
          Separa gli argomenti con una riga vuota: l&apos;assistente cerca per paragrafi. Per le FAQ scrivi domanda e risposta nello stesso paragrafo.
        </p>
        {errore("testo") && <p className="errore-campo">{errore("testo")}</p>}
      </div>
      <PulsanteInvio inCorso="Salvataggio…">{documento ? "Salva modifiche" : "Crea documento (in bozza)"}</PulsanteInvio>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
    </form>
  );
}
