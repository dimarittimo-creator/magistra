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
  immagineAttuale,
}: {
  id: string | null;
  iniziali: Record<string, string>;
  prodotti: Opzione[];
  linee: Opzione[];
  lotti: Opzione[];
  gruppi: Opzione[];
  immagineAttuale: string | null;
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

      <fieldset className="space-y-3">
        <legend className="etichetta">Omaggio extra non a magazzino (facoltativo)</legend>
        <p className="aiuto -mt-2">
          Per materiale che non è nel magazzino del portale, per esempio un espositore. Il portale calcola quanti ne spettano e li scrive nel carrello,
          nell&apos;ordine, nelle email e nella richiesta di evasione al deposito. Lascia vuoto se non serve.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo nome="omaggio_extra_testo" etichetta="Cosa si regala" valore={v.omaggio_extra_testo} errore={e.omaggio_extra_testo} maxLength={120}
            aiuto="Es. espositore da banco Primus Task" />
          <Campo nome="omaggio_extra_ogni" etichetta="Ogni quanti pezzi acquistati" valore={v.omaggio_extra_ogni} errore={e.omaggio_extra_ogni} inputMode="numeric" />
          <Campo nome="omaggio_extra_quantita" etichetta="Quanti in omaggio" valore={v.omaggio_extra_quantita} errore={e.omaggio_extra_quantita} inputMode="numeric" />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="etichetta">Volantino (facoltativo)</legend>
        {immagineAttuale && (
          <div className="flex flex-wrap items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={immagineAttuale} alt="Volantino attuale" className="w-40 rounded border border-line" />
            <Casella nome="rimuovi_immagine">Togli il volantino</Casella>
          </div>
        )}
        <div>
          <label htmlFor="p-immagine" className="etichetta">{immagineAttuale ? "Sostituisci con un'altra immagine" : "Carica un'immagine"}</label>
          <input id="p-immagine" name="immagine" type="file" accept="image/jpeg,image/png,image/webp" className="block" aria-describedby="p-immagine-aiuto" />
          <p id="p-immagine-aiuto" className="aiuto">JPG, PNG o WebP fino a 5 MB. Le farmacie lo vedono nella pagina iniziale («Offerte in corso») e nella scheda del prodotto, finché la promozione è attiva.</p>
          {e.immagine && <p className="errore-campo">{e.immagine}</p>}
        </div>
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
