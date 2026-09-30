import type { Email } from "./invia";
import { componi, esc, sito } from "./modelli";

// Email dell'assistente: avviso agli operatori e risposta dell'operatore alla farmacia.

export function emailRichiestaOperatore(a: string[], r: { conversazioneId: string; cliente: string; motivo: string; ultimoMessaggio: string }): Email {
  return componi(
    a,
    `Magistra – Richiesta di assistenza in chat: ${r.cliente}`,
    [
      `<strong>${esc(r.cliente)}</strong> ha chiesto l'aiuto di un operatore nella chat di Magistra.`,
      `Motivo: ${esc(r.motivo)}`,
      r.ultimoMessaggio ? `Ultimo messaggio: «${esc(r.ultimoMessaggio.slice(0, 500))}»` : "",
      "Rispondi dal pannello: la risposta compare nella stessa chat del cliente.",
    ].filter(Boolean),
    { testo: "Apri la conversazione", url: `${sito()}/admin/assistente/${r.conversazioneId}` },
  );
}

export function emailRispostaOperatore(a: string, r: { percorso: string }): Email {
  return componi(
    a,
    "Magistra – Hai una risposta dal nostro operatore",
    [
      "Buongiorno,",
      "un operatore di Magistra ha risposto alla sua richiesta nella chat dell'assistente.",
      "Per leggerla acceda all'area riservata e apra l'assistente.",
    ],
    { testo: "Apri Magistra", url: `${sito()}${r.percorso}` },
  );
}
