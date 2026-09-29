"use client";

import { useActionState, useState } from "react";
import { EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { caricaFile } from "./azioni";

const TIPI = [
  { valore: "deposito_crystal", testo: "Giacenza del deposito (.xls di Crystal Reports)", accetta: ".xls,.xlsx" },
  { valore: "listino", testo: "Listino prezzi (.xlsx)", accetta: ".xlsx" },
  { valore: "modello", testo: "Modello Magistra (.xlsx)", accetta: ".xlsx" },
];

export function FormImport({ depositi, oggi }: { depositi: { id: string; nome: string; predefinito: boolean }[]; oggi: string }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(caricaFile, {});
  const [tipo, setTipo] = useState("deposito_crystal");
  const [data, setData] = useState(oggi);
  const e = stato.errori ?? {};
  const accetta = TIPI.find((t) => t.valore === tipo)?.accetta;

  // Propone la data scritta nel nome del file (es. giacenza_21-09-2026.xls)
  function fileScelto(ev: React.ChangeEvent<HTMLInputElement>) {
    const m = ev.target.files?.[0]?.name.match(/(\d{2})[-_.](\d{2})[-_.](\d{4})/);
    if (m) setData(`${m[3]}-${m[2]}-${m[1]}`);
  }

  return (
    <form action={azione} className="space-y-4" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="tipo" className="etichetta">Tipo di file</label>
          <select id="tipo" name="tipo" value={tipo} onChange={(ev) => setTipo(ev.target.value)} className="select">
            {TIPI.map((t) => <option key={t.valore} value={t.valore}>{t.testo}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="file" className="etichetta">File</label>
          <input id="file" name="file" type="file" accept={accetta} onChange={fileScelto} className="input py-2"
            aria-invalid={e.file ? true : undefined} aria-describedby={e.file ? "errore-file" : undefined} />
          {e.file && <p id="errore-file" className="errore-campo">{e.file}</p>}
        </div>
        {tipo === "deposito_crystal" && (
          <div>
            <label htmlFor="deposito_id" className="etichetta">Deposito</label>
            <select id="deposito_id" name="deposito_id" defaultValue={depositi.find((d) => d.predefinito)?.id} className="select">
              {depositi.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
            {e.deposito_id && <p className="errore-campo">{e.deposito_id}</p>}
          </div>
        )}
        {tipo !== "listino" && (
          <div>
            <label htmlFor="data_giacenza" className="etichetta">Data della giacenza</label>
            <input id="data_giacenza" name="data_giacenza" type="date" value={data} onChange={(ev) => setData(ev.target.value)} className="input" />
            <p className="aiuto">Proposta dal nome del file quando c&apos;è. La merce spedita dopo questa data resta sottratta.</p>
            {e.data_giacenza && <p className="errore-campo">{e.data_giacenza}</p>}
          </div>
        )}
      </div>
      <EsitoModulo messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Lettura del file…">Carica e mostra l&apos;anteprima</PulsanteInvio>
      <p className="aiuto">Niente viene modificato finché non confermi l&apos;anteprima.</p>
    </form>
  );
}
