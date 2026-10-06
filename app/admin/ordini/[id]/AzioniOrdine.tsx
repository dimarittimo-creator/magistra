"use client";

import { useActionState, useState, useTransition } from "react";
import { Campo, EsitoModulo, PulsanteInvio } from "@/components/moduli";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { formattaEuro } from "@/lib/formato";
import type { StatoOrdine } from "@/lib/ordini/stati";
import { caricaPdfDdt, cambiaStato, inviaAlDeposito, modificaOrdine, registraDdt, segnaPagamentoRicevuto } from "../azioni";

type Riga = { id: string; prodotto_codice: string; prodotto_nome: string; codice_lotto: string; lotto_id: string; quantita: number; quantita_omaggio: number; prezzo_farmacia_netto_cent: number };
type Opzione = { id: string; nome: string };

/** Pulsante di cambio stato, con messaggio facoltativo (obbligatorio per il rifiuto). */
function CambioStato({ id, nuovo, testo, variante = "primary", conMessaggio = false, obbligatorio = false }: {
  id: string; nuovo: StatoOrdine; testo: string; variante?: "primary" | "secondary"; conMessaggio?: boolean; obbligatorio?: boolean;
}) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(cambiaStato.bind(null, id, nuovo), {});
  const [aperto, setAperto] = useState(false);
  if (stato.ok) return <EsitoModulo ok messaggio={stato.messaggio} />;
  if (conMessaggio && !aperto) {
    return <button type="button" className={`btn btn-${variante}`} onClick={() => setAperto(true)}>{testo}</button>;
  }
  return (
    <form action={azione} className={conMessaggio ? "w-full space-y-3 rounded-lg border border-line p-4" : ""}>
      {conMessaggio && (
        <div>
          <label htmlFor={`msg-${nuovo}`} className="etichetta">{obbligatorio ? "Motivo (lo riceve la farmacia)" : "Messaggio per la farmacia (facoltativo)"}</label>
          <textarea id={`msg-${nuovo}`} name="messaggio" rows={2} className="textarea" required={obbligatorio} />
          {stato.errori?.messaggio && <p className="errore-campo">{stato.errori.messaggio}</p>}
        </div>
      )}
      <EsitoModulo messaggio={stato.messaggio} />
      <div className="flex gap-2">
        <PulsanteInvio variante={variante} inCorso="…">{testo}</PulsanteInvio>
        {conMessaggio && <button type="button" className="btn btn-secondary" onClick={() => setAperto(false)}>Annulla</button>}
      </div>
    </form>
  );
}

function InvioDeposito({ id, cumulativa, orario }: { id: string; cumulativa: boolean; orario: string }) {
  const [stato, azione] = useActionState<StatoModulo>(() => inviaAlDeposito(id), {});
  return (
    <form action={azione} className="space-y-2">
      {cumulativa && <p className="text-sm text-muted">Invio cumulativo attivo: l&apos;ordine partirà con l&apos;email delle {orario}. Puoi anche inviarlo subito.</p>}
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      {!stato.ok && <PulsanteInvio inCorso="Invio al deposito…">{cumulativa ? "Invia subito al deposito" : "Invia al deposito"}</PulsanteInvio>}
    </form>
  );
}

function FormModifica({ id, righe, societa, pagamenti, societaId, pagamentoId, onChiudi }: {
  id: string; righe: Riga[]; societa: Opzione[]; pagamenti: Opzione[]; societaId: string; pagamentoId: string; onChiudi: () => void;
}) {
  const [quantita, setQuantita] = useState(() => Object.fromEntries(righe.map((r) => [r.id, String(r.quantita)])));
  const [soc, setSoc] = useState(societaId);
  const [pag, setPag] = useState(pagamentoId);
  const [messaggio, setMessaggio] = useState("");
  const [esito, setEsito] = useState<StatoModulo & { righe?: Record<string, string> }>({});
  const [inCorso, avvia] = useTransition();
  const totale = righe.reduce((s, r) => s + r.prezzo_farmacia_netto_cent * (Number(quantita[r.id]) || 0), 0);

  if (esito.ok) return <EsitoModulo ok messaggio={esito.messaggio} />;
  return (
    <div className="space-y-4 rounded-lg border border-line p-4">
      <p className="text-sm text-muted">Metti 0 per togliere una riga. I prezzi restano quelli dell&apos;ordine.</p>
      <table className="tabella text-sm">
        <thead><tr><th>Prodotto</th><th>Lotto</th><th className="text-right">Prezzo</th><th>Quantità</th></tr></thead>
        <tbody>
          {righe.map((r) => (
            <tr key={r.id}>
              <td>{r.prodotto_nome}</td>
              <td>{r.codice_lotto}</td>
              <td className="text-right">{formattaEuro(r.prezzo_farmacia_netto_cent)}</td>
              <td>
                <label className="sr-only" htmlFor={`mq-${r.id}`}>Quantità {r.prodotto_nome}</label>
                <input id={`mq-${r.id}`} value={quantita[r.id]} inputMode="numeric" className="input w-20 text-right"
                  onChange={(e) => setQuantita((q) => ({ ...q, [r.id]: e.target.value }))} />
                {esito.righe?.[r.lotto_id] && <p className="errore-campo">{esito.righe[r.lotto_id]}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-right text-sm">Nuovo imponibile: <strong>{formattaEuro(totale)}</strong></p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="m-societa" className="etichetta">Fattura e consegna</label>
          <select id="m-societa" value={soc} onChange={(e) => setSoc(e.target.value)} className="select">
            {societa.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="m-pagamento" className="etichetta">Pagamento</label>
          <select id="m-pagamento" value={pag} onChange={(e) => setPag(e.target.value)} className="select">
            {pagamenti.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="m-messaggio" className="etichetta">Messaggio per la farmacia</label>
        <textarea id="m-messaggio" rows={2} value={messaggio} onChange={(e) => setMessaggio(e.target.value)} className="textarea" />
      </div>
      <EsitoModulo messaggio={esito.messaggio} />
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" disabled={inCorso}
          onClick={() => avvia(async () => setEsito(await modificaOrdine(id, { righe: righe.map((r) => ({ rigaId: r.id, quantita: Number(quantita[r.id]) })), societaId: soc, pagamentoId: pag, messaggio })))}>
          {inCorso ? "Salvataggio…" : "Salva le modifiche e chiedi l'accettazione"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onChiudi}>Annulla</button>
      </div>
    </div>
  );
}

function FormDdt({ id, righe, lotti }: { id: string; righe: Riga[]; lotti: Record<string, string[]> }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(registraDdt.bind(null, id), {});
  const e = stato.errori ?? {};
  if (stato.ok) return <EsitoModulo ok messaggio={stato.messaggio} />;
  return (
    <form action={azione} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo nome="ddt_numero" etichetta="Numero DDT" obbligatorio errore={e.ddt_numero} />
        <Campo nome="ddt_data" etichetta="Data DDT" tipo="date" obbligatorio errore={e.ddt_data} />
        <Campo nome="colli" etichetta="Colli" inputMode="numeric" errore={e.colli} />
        <Campo nome="corriere" etichetta="Corriere" />
        <Campo nome="tracking" etichetta="Tracking" />
        <div>
          <label htmlFor="ddt_pdf" className="etichetta">PDF del DDT (facoltativo)</label>
          <input id="ddt_pdf" name="ddt_pdf" type="file" accept="application/pdf" className="input py-2" />
          {e.ddt_pdf && <p className="errore-campo">{e.ddt_pdf}</p>}
        </div>
      </div>
      <details>
        <summary className="cursor-pointer font-semibold text-brand">Il deposito ha spedito quantità o lotti diversi?</summary>
        <table className="tabella text-sm mt-3">
          <thead><tr><th>Prodotto</th><th>Ordinati</th><th>Spediti</th><th>Lotto spedito</th><th>Nota</th></tr></thead>
          <tbody>
            {righe.map((r) => (
              <tr key={r.id}>
                <td>{r.prodotto_nome}<div className="text-xs text-muted">lotto {r.codice_lotto}</div></td>
                <td>{r.quantita + r.quantita_omaggio}</td>
                <td>
                  <label className="sr-only" htmlFor={`q_${r.id}`}>Spediti {r.prodotto_nome}</label>
                  <input id={`q_${r.id}`} name={`q_${r.id}`} defaultValue={r.quantita + r.quantita_omaggio} inputMode="numeric" className="input w-20 text-right" />
                  {e[`q_${r.id}`] && <p className="errore-campo">{e[`q_${r.id}`]}</p>}
                </td>
                <td>
                  <label className="sr-only" htmlFor={`lotto_${r.id}`}>Lotto spedito {r.prodotto_nome}</label>
                  <select id={`lotto_${r.id}`} name={`lotto_${r.id}`} defaultValue={r.codice_lotto} className="select">
                    {[...new Set([r.codice_lotto, ...(lotti[r.prodotto_codice] ?? [])])].map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                  {e[`lotto_${r.id}`] && <p className="errore-campo">{e[`lotto_${r.id}`]}</p>}
                </td>
                <td>
                  <label className="sr-only" htmlFor={`nota_${r.id}`}>Nota {r.prodotto_nome}</label>
                  <input id={`nota_${r.id}`} name={`nota_${r.id}`} className="input" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <div>
        <label htmlFor="note-ddt" className="etichetta">Note interne</label>
        <textarea id="note-ddt" name="note" rows={2} className="textarea" />
      </div>
      <EsitoModulo messaggio={stato.messaggio} />
      <PulsanteInvio inCorso="Registrazione…">Registra il DDT e segna spedito</PulsanteInvio>
    </form>
  );
}

function PagamentoRicevuto({ id }: { id: string }) {
  const [stato, azione] = useActionState<StatoModulo>(() => segnaPagamentoRicevuto(id), {});
  return (
    <form action={azione} className="space-y-2 rounded-lg border border-amber p-4">
      <p className="font-semibold">In attesa del bonifico del cliente: l&apos;ordine parte per il deposito solo dopo il pagamento.</p>
      <EsitoModulo ok={stato.ok} messaggio={stato.messaggio} />
      {!stato.ok && <PulsanteInvio inCorso="…">Segna pagamento ricevuto</PulsanteInvio>}
    </form>
  );
}

export function CaricaPdfDdt({ ordineId }: { ordineId: string }) {
  const [stato, azione] = useActionState<StatoModulo, FormData>(caricaPdfDdt.bind(null, ordineId), {});
  return (
    <form action={azione} className="flex flex-wrap items-center gap-2">
      <label htmlFor="pdf-ddt" className="sr-only">PDF del DDT</label>
      <input id="pdf-ddt" name="ddt_pdf" type="file" accept="application/pdf" className="input py-2 w-auto" />
      <PulsanteInvio variante="secondary" inCorso="Caricamento…" className="btn-piccolo">Carica il PDF</PulsanteInvio>
      {stato.messaggio && <p role={stato.ok ? "status" : "alert"} className={`text-sm w-full ${stato.ok ? "text-slate" : "text-danger"}`}>{stato.messaggio}</p>}
    </form>
  );
}

export function AzioniOrdine(p: {
  id: string;
  stato: StatoOrdine;
  righe: Riga[];
  societa: Opzione[];
  pagamenti: Opzione[];
  societaId: string;
  pagamentoId: string;
  lottiPerProdotto: Record<string, string[]>;
  cumulativa: boolean;
  orario: string;
  attesaBonifico: boolean;
  modificheDaAccettare: boolean;
}) {
  const [modifica, setModifica] = useState(false);
  const modificabile = ["inviato", "in_verifica", "confermato", "modificato"].includes(p.stato);

  if (modifica) {
    return <FormModifica id={p.id} righe={p.righe} societa={p.societa} pagamenti={p.pagamenti} societaId={p.societaId} pagamentoId={p.pagamentoId} onChiudi={() => setModifica(false)} />;
  }
  return (
    <div className="space-y-4">
      {(p.stato === "inviato" || p.stato === "in_verifica") && (
        <div className="flex flex-wrap gap-3">
          <CambioStato id={p.id} nuovo="confermato" testo="Conferma l'ordine" />
          {p.stato === "inviato" && <CambioStato id={p.id} nuovo="in_verifica" testo="Prendi in verifica" variante="secondary" />}
        </div>
      )}
      {p.attesaBonifico && <PagamentoRicevuto id={p.id} />}
      {p.modificheDaAccettare && (
        <p className="avviso avviso-attenzione">
          <strong>In attesa che il cliente accetti le modifiche</strong> (condizioni di vendita, art. 4.3). L&apos;ordine potrà andare al deposito
          solo dopo la sua accettazione; se rifiuta o non risponde entro i termini, l&apos;ordine si chiude e la merce torna disponibile.
        </p>
      )}
      {(p.stato === "confermato" || p.stato === "modificato") && !p.attesaBonifico && !p.modificheDaAccettare && (
        <InvioDeposito id={p.id} cumulativa={p.cumulativa} orario={p.orario} />
      )}
      {p.stato === "inviato_deposito" && <CambioStato id={p.id} nuovo="in_preparazione" testo="Segna «in preparazione»" variante="secondary" />}
      {(p.stato === "inviato_deposito" || p.stato === "in_preparazione") && (
        <section className="space-y-3">
          <h3 className="text-xl font-serif text-magistra-blu">Registra il DDT</h3>
          <FormDdt id={p.id} righe={p.righe} lotti={p.lottiPerProdotto} />
        </section>
      )}
      {p.stato === "spedito" && <CambioStato id={p.id} nuovo="consegnato" testo="Segna consegnato" variante="secondary" />}
      {modificabile && (
        <div className="flex flex-wrap gap-3 border-t border-line pt-4">
          <button type="button" className="btn btn-secondary" onClick={() => setModifica(true)}>Modifica (quantità, società, pagamento)</button>
          <CambioStato id={p.id} nuovo="rifiutato" testo="Rifiuta l'ordine" variante="secondary" conMessaggio obbligatorio />
        </div>
      )}
    </div>
  );
}
