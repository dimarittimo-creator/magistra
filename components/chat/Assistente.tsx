"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Messaggi, type MessaggioChat, type PropostaChat } from "@/components/chat/Messaggi";

// Chat dell'assistente nell'area farmacia: pulsante sempre visibile in basso a destra.
// All'apertura: informativa (GDPR) e dichiarazione che si parla con un'intelligenza artificiale (AI Act).

type Conversazione = {
  id: string;
  stato: "aperta" | "operatore" | "chiusa";
  modalita: "ai" | "prova" | "solo_operatore";
  richiestaAperta: boolean;
  messaggi: MessaggioChat[];
};

type Risposta = { conversazione?: Conversazione | null; mesiConservazione?: number; messaggio?: string; errore?: string };

async function chiama(corpo?: Record<string, unknown>): Promise<Risposta> {
  const r = await fetch("/api/assistente", corpo ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) } : { cache: "no-store" });
  return (await r.json().catch(() => ({ errore: "Si è verificato un problema. Riprovi." }))) as Risposta;
}

export function Assistente() {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [caricato, setCaricato] = useState(false);
  const [conversazione, setConversazione] = useState<Conversazione | null>(null);
  const [mesi, setMesi] = useState(24);
  const [testo, setTesto] = useState("");
  const [inAttesa, setInAttesa] = useState<string | null>(null);
  const [occupato, setOccupato] = useState(false);
  const [avviso, setAvviso] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);
  const fondo = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  const aggiorna = useCallback(async () => {
    const r = await chiama();
    if (r.errore) return;
    setConversazione(r.conversazione ?? null);
    if (r.mesiConservazione) setMesi(r.mesiConservazione);
    setCaricato(true);
  }, []);

  // Apertura dal link dell'email (?assistente=1)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("assistente") === "1") setAperto(true);
  }, []);

  useEffect(() => {
    if (aperto) void aggiorna();
  }, [aperto, aggiorna]);

  // In attesa dell'operatore: controlla le nuove risposte ogni 15 secondi
  useEffect(() => {
    if (!aperto || conversazione?.stato !== "operatore") return;
    const t = setInterval(() => void aggiorna(), 15_000);
    return () => clearInterval(t);
  }, [aperto, conversazione?.stato, aggiorna]);

  useEffect(() => {
    fondo.current?.scrollIntoView({ block: "end" });
  }, [conversazione?.messaggi.length, inAttesa, aperto]);

  async function esegui(corpo: Record<string, unknown>, dopo?: (r: Risposta) => void) {
    setOccupato(true);
    setAvviso(null);
    const r = await chiama(corpo);
    setOccupato(false);
    setInAttesa(null);
    if (r.conversazione !== undefined) setConversazione(r.conversazione);
    if (r.errore) setAvviso({ tipo: "errore", testo: r.errore });
    else dopo?.(r);
  }

  async function invia(e?: React.FormEvent) {
    e?.preventDefault();
    const t = testo.trim();
    if (!t || !conversazione || occupato) return;
    setTesto("");
    setInAttesa(t);
    await esegui({ azione: "invia", conversazioneId: conversazione.id, testo: t }, () => campo.current?.focus());
  }

  const decidi = (p: PropostaChat, conferma: boolean) =>
    esegui({ azione: "proposta", propostaId: p.id, conferma }, (r) => {
      if (r.messaggio) setAvviso({ tipo: "ok", testo: r.messaggio });
      if (conferma) router.refresh(); // aggiorna il conteggio del carrello nel menu
    });

  const provvisori: MessaggioChat[] = inAttesa ? [{ id: -1, ruolo: "utente", testo: inAttesa, creato_il: new Date().toISOString(), proposte: [] }] : [];

  return (
    <>
      {!aperto && (
        <button type="button" className="btn btn-primary fixed bottom-4 right-4 z-40 shadow-lg" onClick={() => setAperto(true)} aria-haspopup="dialog">
          <span aria-hidden="true">💬</span> Assistente
        </button>
      )}

      {aperto && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby="assistente-titolo"
          className="fixed z-50 inset-0 sm:inset-auto sm:bottom-4 sm:right-4 sm:w-[26rem] sm:h-[min(40rem,calc(100vh-2rem))] flex flex-col bg-surface border border-line sm:rounded-xl shadow-2xl"
        >
          <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <h2 id="assistente-titolo" className="text-xl text-magistra-blu">
                Assistente Magistra
              </h2>
              <p className="text-xs text-muted">Assistente virtuale basato su intelligenza artificiale</p>
            </div>
            <button type="button" className="btn btn-secondary btn-piccolo" onClick={() => setAperto(false)}>
              Chiudi
            </button>
          </header>

          {conversazione?.modalita === "prova" && (
            <p className="avviso avviso-attenzione text-xs mx-3 mt-2">Modalità di prova: risposte simulate, senza intelligenza artificiale (solo sul sito in locale).</p>
          )}

          <div className="flex-1 overflow-y-auto px-3 py-3" aria-live="polite">
            {!caricato ? (
              <p className="text-muted">Caricamento…</p>
            ) : !conversazione ? (
              <div className="space-y-3 text-sm">
                <p className="font-semibold">Prima di iniziare</p>
                <p>
                  Sta per scrivere a un <strong>assistente virtuale basato su intelligenza artificiale</strong>, non a una persona. Può sempre chiedere di parlare con un
                  operatore.
                </p>
                <p>
                  Disponibilità, prezzi, promozioni e ordini vengono letti in tempo reale dal portale; le informazioni sui prodotti provengono solo dai contenuti approvati
                  da Sagè Pharma e Bioeleva. L&apos;assistente non dà consigli medici su singoli pazienti e non aggiunge nulla al carrello senza la sua conferma.
                </p>
                <p>
                  La conversazione viene salvata per {mesi} mesi e poi cancellata. I messaggi sono elaborati per conto di Sagè Pharma e Bioeleva anche dal fornitore del
                  servizio di intelligenza artificiale (Anthropic). <strong>Non inserisca dati sanitari o personali dei pazienti.</strong>{" "}
                  <Link href="/privacy" target="_blank">
                    Informativa privacy
                  </Link>
                </p>
                <button type="button" className="btn btn-primary w-full" disabled={occupato} onClick={() => esegui({ azione: "inizia" })}>
                  Ho letto, inizia la conversazione
                </button>
              </div>
            ) : (
              <>
                <Messaggi
                  messaggi={[...conversazione.messaggi, ...provvisori]}
                  azioniProposta={(p) => (
                    <>
                      <button type="button" className="btn btn-primary btn-piccolo" disabled={occupato} onClick={() => decidi(p, true)}>
                        Conferma
                      </button>
                      <button type="button" className="btn btn-secondary btn-piccolo" disabled={occupato} onClick={() => decidi(p, false)}>
                        Annulla
                      </button>
                    </>
                  )}
                />
                {inAttesa && <p className="text-sm text-muted mt-3">L&apos;assistente sta scrivendo…</p>}
                {conversazione.richiestaAperta && <p className="avviso avviso-info text-sm mt-3">In attesa di un operatore: le risponderà qui (riceverà anche un&apos;email).</p>}
              </>
            )}
            <div ref={fondo} />
          </div>

          {avviso && (
            <p role={avviso.tipo === "errore" ? "alert" : "status"} className={`avviso ${avviso.tipo === "errore" ? "avviso-errore" : "avviso-ok"} text-sm mx-3 mb-2`}>
              {avviso.testo}
            </p>
          )}

          {conversazione && (
            <footer className="border-t border-line px-3 py-3 space-y-2">
              <form onSubmit={invia} className="flex gap-2 items-end">
                <label htmlFor="assistente-testo" className="sr-only">
                  Messaggio per l&apos;assistente
                </label>
                <textarea
                  id="assistente-testo"
                  ref={campo}
                  className="textarea flex-1 resize-none"
                  rows={2}
                  maxLength={2000}
                  value={testo}
                  placeholder={conversazione.stato === "operatore" ? "Scriva all'operatore…" : "Scriva la sua domanda…"}
                  onChange={(e) => setTesto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void invia();
                    }
                  }}
                />
                <button type="submit" className="btn btn-primary" disabled={occupato || !testo.trim()}>
                  Invia
                </button>
              </form>
              <div className="flex flex-wrap gap-2 text-sm">
                {!conversazione.richiestaAperta && conversazione.modalita !== "solo_operatore" && (
                  <button type="button" className="btn btn-secondary btn-piccolo" disabled={occupato} onClick={() => esegui({ azione: "operatore", conversazioneId: conversazione.id })}>
                    Parla con un operatore
                  </button>
                )}
                {!conversazione.richiestaAperta && (
                  <button type="button" className="btn btn-secondary btn-piccolo" disabled={occupato} onClick={() => esegui({ azione: "nuova", conversazioneId: conversazione.id })}>
                    Nuova conversazione
                  </button>
                )}
              </div>
            </footer>
          )}
        </section>
      )}
    </>
  );
}
