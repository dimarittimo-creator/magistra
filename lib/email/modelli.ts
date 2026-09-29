import type { Email } from "./invia";

// Modelli delle email del portale. Stile coerente con docs/GRAFICA.md
// (blu Magistra, filetto rame, pay off nel piè di pagina).

const sito = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function esc(testo: string): string {
  return testo.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function impagina(paragrafi: string[], pulsante?: { testo: string; url: string }): string {
  const corpo = paragrafi.map((p) => `<p style="font-size:16px;line-height:1.5;margin:0 0 14px">${p}</p>`).join("");
  const bottone = pulsante
    ? `<p style="margin:26px 0"><a href="${pulsante.url}" style="background:#022976;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px;display:inline-block">${esc(pulsante.testo)}</a></p>`
    : "";
  return `<!doctype html><html lang="it"><body style="margin:0;padding:24px;background:#f6f7f7;font-family:Arial,Helvetica,sans-serif;color:#1d2427">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dfe4e6;border-radius:12px;padding:28px">
<p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:26px;color:#022976">Magistra</p>
<div style="width:48px;height:2px;background:#b0652a;margin:0 0 20px"></div>
${corpo}${bottone}
<hr style="border:none;border-top:1px solid #dfe4e6;margin:24px 0" />
<p style="font-size:13px;color:#5a6a70;margin:0"><em style="color:#022976">Magistra – Semplicemente Magistrale</em><br />Sagè Pharma S.r.l. · Bioeleva S.r.l.</p>
</div></body></html>`;
}

function soloTesto(paragrafi: string[], pulsante?: { testo: string; url: string }): string {
  const righe = paragrafi.map((p) => p.replace(/<[^>]+>/g, ""));
  if (pulsante) righe.push(`${pulsante.testo}: ${pulsante.url}`);
  righe.push("", "Magistra – Semplicemente Magistrale", "Sagè Pharma S.r.l. · Bioeleva S.r.l.");
  return righe.join("\n\n");
}

function componi(a: string | string[], oggetto: string, paragrafi: string[], pulsante?: { testo: string; url: string }): Email {
  return { a, oggetto, html: impagina(paragrafi, pulsante), testo: soloTesto(paragrafi, pulsante) };
}

type DatiFarmacia = { ragione_sociale: string; titolare: string; email: string; citta?: string | null; partita_iva?: string };

export function emailIscrizioneRicevuta(f: DatiFarmacia): Email {
  return componi(f.email, "Magistra – Richiesta di iscrizione ricevuta", [
    `Gentile ${esc(f.titolare)},`,
    `abbiamo ricevuto la richiesta di iscrizione di <strong>${esc(f.ragione_sociale)}</strong> al portale Magistra.`,
    "Riceverai a parte un'email per confermare il tuo indirizzo. Dopo la conferma, la nostra amministrazione verificherà i dati: ti scriveremo appena l'iscrizione sarà approvata. Fino ad allora prezzi e disponibilità non sono visibili.",
  ]);
}

export function emailNuovaIscrizioneAdmin(a: string[], f: DatiFarmacia & { id: string }): Email {
  return componi(
    a,
    `Magistra – Nuova iscrizione da approvare: ${f.ragione_sociale}`,
    [
      "Una nuova farmacia ha chiesto l'iscrizione a Magistra:",
      `<strong>${esc(f.ragione_sociale)}</strong><br />Titolare: ${esc(f.titolare)}<br />Partita IVA: ${esc(f.partita_iva ?? "")}<br />Città: ${esc(f.citta ?? "")}<br />Email: ${esc(f.email)}`,
      "Verifica i dati e approva o blocca l'iscrizione dall'area amministrazione.",
    ],
    { testo: "Apri l'iscrizione", url: `${sito()}/admin/farmacie/${f.id}` },
  );
}

export function emailIscrizioneApprovata(f: DatiFarmacia): Email {
  return componi(
    f.email,
    "Magistra – Iscrizione approvata",
    [
      `Gentile ${esc(f.titolare)},`,
      `l'iscrizione di <strong>${esc(f.ragione_sociale)}</strong> a Magistra è stata approvata.`,
      "Da ora puoi accedere all'area riservata con la tua email e la password scelta.",
    ],
    { testo: "Accedi a Magistra", url: `${sito()}/accesso` },
  );
}

export function emailAccountBloccato(f: DatiFarmacia, motivo: string | null): Email {
  return componi(f.email, "Magistra – Account non attivo", [
    `Gentile ${esc(f.titolare)},`,
    `l'accesso di <strong>${esc(f.ragione_sociale)}</strong> all'area riservata di Magistra non è attivo.`,
    ...(motivo ? [`Motivo: ${esc(motivo)}`] : []),
    "Per informazioni rispondi a questa email o contatta la nostra amministrazione.",
  ]);
}
