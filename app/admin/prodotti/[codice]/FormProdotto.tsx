"use client";

import { useActionState } from "react";
import { Campo, Casella, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { salvaProdotto } from "../azioni";

export function FormProdotto({ codice, iniziali, linee, aree, ivaPredefinita }: { codice: string; iniziali: Record<string, string>; linee: string[]; aree: string[]; ivaPredefinita: number }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(salvaProdotto.bind(null, codice), {});
  const v = stato.valori ?? iniziali;
  const e = stato.errori ?? {};
  return (
    <form action={azione} className="space-y-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="nome" etichetta="Nome nel catalogo" obbligatorio valore={v.nome} errore={e.nome} className="sm:col-span-2" />
        <Campo nome="formato" etichetta="Formato" valore={v.formato} aiuto="Es. 20 compresse, 200 ml" />
        <div>
          <label htmlFor="campo-linea" className="etichetta">Linea</label>
          <input id="campo-linea" name="linea" list="elenco-linee" defaultValue={v.linea} className="input" />
          <datalist id="elenco-linee">{linee.map((l) => <option key={l} value={l} />)}</datalist>
          <p className="aiuto">Scegli dall&apos;elenco o scrivi una linea nuova</p>
        </div>
        <div>
          <label htmlFor="campo-area" className="etichetta">Area terapeutica</label>
          <input id="campo-area" name="area" list="elenco-aree" defaultValue={v.area} className="input" />
          <datalist id="elenco-aree">{aree.map((a) => <option key={a} value={a} />)}</datalist>
        </div>
        <Campo nome="prezzo" etichetta="Prezzo al pubblico IVA inclusa (€)" valore={v.prezzo} errore={e.prezzo} inputMode="text"
          aiuto="Vuoto = prodotto non visibile alle farmacie" />
        <Campo nome="iva" etichetta="IVA %" valore={v.iva} errore={e.iva} aiuto={`Vuoto = predefinita (${ivaPredefinita}%)`} />
        <Campo nome="minimo_ordine" etichetta="Ordine minimo (pezzi)" valore={v.minimo_ordine} errore={e.minimo_ordine} inputMode="numeric" />
        <Campo nome="multiplo" etichetta="Multiplo d'ordine" valore={v.multiplo} errore={e.multiplo} inputMode="numeric" />
        <Campo nome="soglia_esaurimento" etichetta="Soglia «In esaurimento»" valore={v.soglia_esaurimento} errore={e.soglia_esaurimento} inputMode="numeric"
          aiuto="Vuoto = soglia generale delle impostazioni" />
      </div>
      <div>
        <label htmlFor="descrizione" className="etichetta">Descrizione</label>
        <textarea id="descrizione" name="descrizione" rows={3} defaultValue={v.descrizione} className="textarea" />
      </div>
      <div className="space-y-2">
        <Casella nome="attivo" selezionata={v.attivo === "on"}>Prodotto attivo nel catalogo</Casella>
        <Casella nome="visibile_privati" selezionata={v.visibile_privati === "on"}>Visibile nell&apos;area Privati</Casella>
      </div>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Salvataggio…">Salva</PulsanteInvio>
    </form>
  );
}
