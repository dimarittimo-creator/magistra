"use client";

import { useActionState, useState } from "react";
import { Campo, Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { salvaPromozione } from "./azioni";

type Opzione = { id: string; nome: string };

export function FormPromozione({
  id,
  iniziali,
  prodotti,
  linee,
  lotti,
  gruppi,
}: {
  id: string | null;
  iniziali: Record<string, string>;
  prodotti: Opzione[];
  linee: Opzione[];
  lotti: Opzione[];
  gruppi: Opzione[];
}) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(salvaPromozione.bind(null, id), {});
  const v = stato.valori ?? iniziali;
  const e = stato.errori ?? {};
  const [tipo, setTipo] = useState(v.tipo || "sconto_percentuale");
  const [ambito, setAmbito] = useState(v.ambito || "prodotto");

  const Selezione = ({ nome, etichetta, opzioni, vuota }: { nome: string; etichetta: string; opzioni: Opzione[]; vuota?: string }) => (
    <div>
      <label htmlFor={`p-${nome}`} className="etichetta">{etichetta}</label>
      <select id={`p-${nome}`} name={nome} defaultValue={v[nome] ?? ""} className="select" aria-invalid={e[nome] ? true : undefined}>
        <option value="">{vuota ?? "Scegli…"}</option>
        {opzioni.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
      </select>
      {e[nome] && <p className="errore-campo">{e[nome]}</p>}
    </div>
  );

  return (
    <form action={azione} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="nome" etichetta="Nome" obbligatorio valore={v.nome} errore={e.nome} aiuto="Lo vedono le farmacie (es. Autunno 2026)" />
        <Campo nome="descrizione" etichetta="Nota interna" valore={v.descrizione} />
      </div>

      <fieldset className="space-y-3">
        <legend className="etichetta">Tipo</legend>
        <div className="flex flex-wrap gap-4">
          {[["sconto_percentuale", "Sconto %"], ["sconto_merce", "Sconto merce (es. 10+2)"], ["omaggio", "Omaggio di un altro prodotto"]].map(([valore, testo]) => (
            <label key={valore} className="flex items-center gap-2">
              <input type="radio" name="tipo" value={valore} checked={tipo === valore} onChange={() => setTipo(valore)} className="size-5 accent-[var(--brand)]" />
              {testo}
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {tipo === "sconto_percentuale" ? (
            <Campo nome="sconto_percentuale" etichetta="Sconto %" valore={v.sconto_percentuale} errore={e.sconto_percentuale}
              aiuto="Sul prezzo al pubblico IVA inclusa; vale se è migliore dello sconto del lotto" />
          ) : (
            <>
              <Campo nome="compra" etichetta="Ogni (pezzi acquistati)" valore={v.compra} errore={e.compra} inputMode="numeric" />
              <Campo nome="omaggio_quantita" etichetta="Pezzi in omaggio" valore={v.omaggio_quantita} errore={e.omaggio_quantita} inputMode="numeric" />
              {tipo === "omaggio" && <Selezione nome="omaggio_prodotto_codice" etichetta="Prodotto in omaggio" opzioni={prodotti} />}
            </>
          )}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="etichetta">A cosa si applica</legend>
        <div>
          <label htmlFor="p-ambito" className="sr-only">Ambito</label>
          <select id="p-ambito" name="ambito" value={ambito} onChange={(ev) => setAmbito(ev.target.value)} className="select">
            <option value="catalogo">Tutto il catalogo</option>
            <option value="linea">Una linea</option>
            <option value="prodotto">Un prodotto</option>
            <option value="lotto">Un lotto</option>
          </select>
        </div>
        {ambito === "prodotto" && <Selezione nome="prodotto_codice" etichetta="Prodotto" opzioni={prodotti} />}
        {ambito === "linea" && <Selezione nome="linea_id" etichetta="Linea" opzioni={linee} />}
        {ambito === "lotto" && <Selezione nome="lotto_id" etichetta="Lotto" opzioni={lotti} />}
        <Selezione nome="gruppo_id" etichetta="Per quali farmacie" opzioni={gruppi} vuota="Tutte le farmacie" />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3 items-end">
        <Campo nome="inizio" etichetta="Dal" tipo="date" obbligatorio valore={v.inizio} errore={e.inizio} />
        <Campo nome="fine" etichetta="Al (compreso)" tipo="date" obbligatorio valore={v.fine} errore={e.fine} />
        <Casella nome="sospesa" selezionata={v.sospesa === "on"}>Sospesa (non si applica)</Casella>
      </div>

      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Salvataggio…">{id ? "Salva la promozione" : "Crea la promozione"}</PulsanteInvio>
    </form>
  );
}
