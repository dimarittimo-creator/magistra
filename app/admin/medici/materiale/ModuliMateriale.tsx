"use client";

import { useActionState, useState, useTransition } from "react";
import { Campo, Casella, EsitoModulo } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { eliminaMateriale, preparaCaricamento, pubblicaMateriale, registraMateriale } from "./azioni";

const TIPI = [
  { valore: "studio", testo: "Studio scientifico" },
  { valore: "brochure", testo: "Brochure" },
  { valore: "scheda_tecnica", testo: "Scheda tecnica" },
  { valore: "altro", testo: "Altro documento" },
];

export function FormCaricaMateriale({ prodotti }: { prodotti: { codice: string; nome: string }[] }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(registraMateriale, {});
  const [erroreFile, setErroreFile] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();
  const e: Record<string, string> = { ...stato.errori, ...(erroreFile ? { file: erroreFile } : {}) };
  const v: Record<string, string> = stato.ok ? {} : (stato.valori ?? {});

  // Il PDF va prima nell'archivio (indirizzo firmato), poi si registra il documento.
  function invia(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    const pdf = fd.get("file");
    fd.delete("file");
    setErroreFile(null);
    avvia(async () => {
      if (pdf instanceof File && pdf.size > 0) {
        const preparato = await preparaCaricamento(pdf.name, pdf.size);
        if (!preparato.url || !preparato.percorso) return setErroreFile(preparato.errore ?? "Caricamento non riuscito");
        const r = await fetch(preparato.url, { method: "PUT", headers: { "content-type": "application/pdf" }, body: pdf }).catch(() => null);
        if (!r?.ok) return setErroreFile("Caricamento del file non riuscito. Riprova.");
        fd.set("percorso", preparato.percorso);
        fd.set("file_nome", pdf.name);
      }
      azione(fd);
    });
  }

  return (
    <form onSubmit={invia} key={stato.ok ? stato.messaggio : "modulo"} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo nome="titolo" etichetta="Titolo" obbligatorio valore={v.titolo} errore={e.titolo} className="sm:col-span-2" />
        <div>
          <label htmlFor="campo-tipo" className="etichetta">Tipo<span className="text-danger" aria-hidden="true"> *</span></label>
          <select id="campo-tipo" name="tipo" defaultValue={v.tipo ?? "studio"} className="select">
            {TIPI.map((t) => (
              <option key={t.valore} value={t.valore}>{t.testo}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="campo-prodotto_codice" className="etichetta">Prodotto collegato (facoltativo)</label>
          <select id="campo-prodotto_codice" name="prodotto_codice" defaultValue={v.prodotto_codice ?? ""} className="select">
            <option value="">Nessuno (documento generale)</option>
            {prodotti.map((p) => (
              <option key={p.codice} value={p.codice}>{p.nome}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="campo-descrizione" className="etichetta">Descrizione breve (facoltativa)</label>
          <textarea id="campo-descrizione" name="descrizione" rows={2} maxLength={1000} defaultValue={v.descrizione} className="textarea" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="campo-file" className="etichetta">File PDF (massimo 20 MB)<span className="text-danger" aria-hidden="true"> *</span></label>
          <input id="campo-file" name="file" type="file" accept="application/pdf,.pdf" className="input"
            aria-invalid={e.file ? true : undefined} aria-describedby={e.file ? "campo-file-errore" : undefined} />
          {e.file && <p id="campo-file-errore" className="errore-campo">{e.file}</p>}
        </div>
      </div>
      <Casella nome="pubblicato" selezionata={v.pubblicato === "on"}>
        Pubblica subito (altrimenti resta in bozza, visibile solo allo staff)
      </Casella>
      <p className="aiuto">Carica solo materiale approvato dal gruppo e coerente con le notifiche al Ministero e i claim consentiti.</p>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      <button type="submit" className="btn btn-primary" disabled={inCorso} aria-busy={inCorso}>
        {inCorso ? "Caricamento…" : "Carica il documento"}
      </button>
    </form>
  );
}

export function AzioniMateriale({ id, pubblicato, titolo }: { id: string; pubblicato: boolean; titolo: string }) {
  const [inCorso, avvia] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn btn-secondary btn-piccolo" disabled={inCorso} onClick={() => avvia(() => pubblicaMateriale(id, !pubblicato))}>
        {pubblicato ? "Ritira" : "Pubblica"}
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-piccolo"
        disabled={inCorso}
        onClick={() => {
          if (confirm(`Eliminare definitivamente «${titolo}»?`)) avvia(() => eliminaMateriale(id));
        }}
      >
        Elimina
      </button>
    </div>
  );
}
