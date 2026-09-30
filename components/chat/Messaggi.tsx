import type { ReactNode } from "react";

// Elenco dei messaggi di una conversazione con l'assistente.
// Usato dalla chat della farmacia (con i pulsanti delle proposte) e dal pannello operatore (solo lettura).

export type MessaggioChat = {
  id: number;
  ruolo: "utente" | "assistente" | "operatore";
  testo: string;
  creato_il: string;
  proposte: PropostaChat[];
};

export type PropostaChat = {
  id: string;
  prodotto_nome: string;
  codice_lotto: string;
  scadenza: string | null;
  quantita: number;
  stato: "in_attesa" | "confermata" | "annullata" | "non_valida";
  esito: string | null;
};

const ETICHETTA_PROPOSTA: Record<PropostaChat["stato"], { testo: string; classe: string }> = {
  in_attesa: { testo: "Da confermare", classe: "pill-warn" },
  confermata: { testo: "Aggiunta al carrello", classe: "pill-ok" },
  annullata: { testo: "Annullata", classe: "pill-off" },
  non_valida: { testo: "Non più valida", classe: "pill-bad" },
};

const ora = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const data = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", year: "numeric" });

/** Rende cliccabili i percorsi interni del portale citati nelle risposte (es. /farmacia/ordini/…). */
function conLink(testo: string, collegamenti: boolean): ReactNode[] {
  if (!collegamenti) return [testo];
  return testo.split(/(\/(?:farmacia|condizioni|privacy)[\w/.-]*[\w/])/g).map((parte, i) =>
    i % 2 === 1 ? (
      <a key={i} href={parte}>
        {parte}
      </a>
    ) : (
      parte
    ),
  );
}

const MITTENTE: Record<MessaggioChat["ruolo"], string> = {
  utente: "Farmacia",
  assistente: "Assistente virtuale (IA)",
  operatore: "Operatore Magistra",
};

export function Messaggi({
  messaggi,
  azioniProposta,
  collegamenti = true,
  nomeUtente,
}: {
  messaggi: MessaggioChat[];
  azioniProposta?: (p: PropostaChat) => ReactNode;
  collegamenti?: boolean;
  nomeUtente?: string;
}) {
  return (
    <ol className="space-y-3">
      {messaggi.map((m) => {
        const mio = m.ruolo === "utente";
        return (
          <li key={m.id} className={`flex flex-col ${mio ? "items-end" : "items-start"}`}>
            <p className="text-xs text-muted mb-0.5">
              {m.ruolo === "utente" && nomeUtente ? nomeUtente : MITTENTE[m.ruolo]} · {ora.format(new Date(m.creato_il))}
            </p>
            <div
              className={`max-w-[90%] rounded-xl px-3 py-2 whitespace-pre-line break-words ${
                mio ? "bg-brand text-brand-ink" : m.ruolo === "operatore" ? "bg-amber-soft border border-amber" : "bg-brand-soft"
              }`}
            >
              {conLink(m.testo, collegamenti && !mio)}
            </div>
            {m.proposte.map((p) => (
              <div key={p.id} className="panel mt-2 p-3 w-[90%] text-sm" data-proposta={p.id}>
                <p className="font-semibold">Proposta per il carrello</p>
                <p>
                  {p.quantita} pezzi di {p.prodotto_nome}
                  <br />
                  Lotto {p.codice_lotto}
                  {p.scadenza ? `, scadenza ${data.format(new Date(p.scadenza))}` : ""}
                </p>
                <p className="mt-1">
                  <span className={`pill ${ETICHETTA_PROPOSTA[p.stato].classe}`}>{ETICHETTA_PROPOSTA[p.stato].testo}</span>
                  {p.esito && p.stato !== "annullata" ? <span className="text-muted"> {p.esito}</span> : null}
                </p>
                {p.stato === "in_attesa" && azioniProposta ? <div className="mt-2 flex gap-2">{azioniProposta(p)}</div> : null}
              </div>
            ))}
          </li>
        );
      })}
    </ol>
  );
}
