import type { Email } from "./invia";
import { componi, esc, sito } from "./modelli";

// Email dell'area Medici (docs/AREA_MEDICI.md).

type DatiMedicoEmail = { nome: string; cognome: string; email: string };
const dottore = (m: DatiMedicoEmail) => `Gentile Dott. ${esc(m.nome)} ${esc(m.cognome)},`;

export function emailIscrizioneMedicoRicevuta(m: DatiMedicoEmail): Email {
  return componi(m.email, "Magistra – Richiesta di accesso all'area Medici ricevuta", [
    dottore(m),
    "abbiamo ricevuto la sua richiesta di accesso all'area Medici di Magistra.",
    "Riceverà a parte un'email per confermare l'indirizzo. Dopo la conferma verificheremo l'iscrizione all'Ordine e le scriveremo appena l'accesso sarà attivo.",
  ]);
}

export function emailNuovaIscrizioneMedicoAdmin(
  a: string[],
  m: DatiMedicoEmail & { id: string; specializzazione: string; numero_iscrizione: string; ordine_provincia: string; citta: string },
): Email {
  return componi(
    a,
    `Magistra – Nuovo medico da approvare: ${m.nome} ${m.cognome}`,
    [
      "Un medico ha chiesto l'accesso all'area Medici:",
      `<strong>Dott. ${esc(m.nome)} ${esc(m.cognome)}</strong><br />Specializzazione: ${esc(m.specializzazione)}<br />Iscrizione all'Ordine di ${esc(m.ordine_provincia)}: n. ${esc(m.numero_iscrizione)}<br />Città: ${esc(m.citta)}<br />Email: ${esc(m.email)}`,
      "Verifica l'iscrizione all'Ordine (albo FNOMCeO) e approva o rifiuta dall'area amministrazione.",
    ],
    { testo: "Apri la richiesta", url: `${sito()}/admin/medici/${m.id}` },
  );
}

export function emailMedicoApprovato(m: DatiMedicoEmail): Email {
  return componi(
    m.email,
    "Magistra – Accesso all'area Medici attivo",
    [dottore(m), "il suo accesso all'area Medici di Magistra è attivo: può consultare schede prodotto e materiale scientifico, fare domande all'assistente e richiedere campioni."],
    { testo: "Entra nell'area Medici", url: `${sito()}/accesso?area=medici` },
  );
}

export function emailMedicoNonAttivo(m: DatiMedicoEmail, motivo: string | null): Email {
  return componi(m.email, "Magistra – Accesso all'area Medici non attivo", [
    dottore(m),
    "il suo accesso all'area Medici di Magistra non è attivo.",
    ...(motivo ? [`Motivo: ${esc(motivo)}`] : []),
    "Per informazioni può rispondere a questa email.",
  ]);
}

type RichiestaEmail = { id: string; prodotto_nome: string; quantita: number; note: string | null };

export function emailNuovaRichiestaCampioniAdmin(a: string[], m: DatiMedicoEmail & { citta: string }, r: RichiestaEmail): Email {
  return componi(
    a,
    `Magistra – Richiesta campioni: ${r.prodotto_nome} (Dott. ${m.cognome})`,
    [
      `Il Dott. ${esc(m.nome)} ${esc(m.cognome)} (${esc(m.citta)}) chiede <strong>${r.quantita} ${r.quantita === 1 ? "confezione" : "confezioni"}</strong> di <strong>${esc(r.prodotto_nome)}</strong>.`,
      ...(r.note ? [`Note: ${esc(r.note)}`] : []),
    ],
    { testo: "Gestisci la richiesta", url: `${sito()}/admin/medici/campioni` },
  );
}

const ESITI: Record<string, string> = {
  in_lavorazione: "è in lavorazione: la spediremo a breve all'indirizzo dello studio.",
  spedita: "è stata spedita all'indirizzo dello studio.",
  non_accolta: "non può essere accolta.",
};

export function emailEsitoCampioni(m: DatiMedicoEmail, r: RichiestaEmail, stato: string, messaggio: string | null): Email {
  return componi(
    m.email,
    `Magistra – Richiesta campioni ${r.prodotto_nome}`,
    [
      dottore(m),
      `la sua richiesta di ${r.quantita} ${r.quantita === 1 ? "confezione" : "confezioni"} di <strong>${esc(r.prodotto_nome)}</strong> ${ESITI[stato] ?? "è stata aggiornata."}`,
      ...(messaggio ? [esc(messaggio)] : []),
    ],
    { testo: "Le mie richieste", url: `${sito()}/medici/campioni` },
  );
}
