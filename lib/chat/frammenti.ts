// Suddivisione dei documenti della base di conoscenza in frammenti da cercare.
// Si taglia sui paragrafi (poi sulle frasi) per non spezzare un'informazione a metà;
// ogni frammento riporta il titolo del documento, così resta comprensibile da solo.
// Funzioni pure: usate dal salvataggio dei documenti e dai test.

const LUNGHEZZA_MASSIMA = 1200;

/** Pulisce il testo incollato o estratto da un file (spazi, righe vuote multiple, a capo di Windows). */
export function normalizzaTesto(testo: string): string {
  return testo
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function spezzaLungo(paragrafo: string): string[] {
  if (paragrafo.length <= LUNGHEZZA_MASSIMA) return [paragrafo];
  const frasi = paragrafo.match(/[^.!?;\n]+[.!?;]*\s*/g) ?? [paragrafo];
  const pezzi: string[] = [];
  let attuale = "";
  for (const frase of frasi) {
    if (attuale && attuale.length + frase.length > LUNGHEZZA_MASSIMA) {
      pezzi.push(attuale.trim());
      attuale = "";
    }
    // Frase più lunga del massimo (testo senza punteggiatura): taglio netto
    for (let i = 0; i < frase.length; i += LUNGHEZZA_MASSIMA) {
      const parte = frase.slice(i, i + LUNGHEZZA_MASSIMA);
      if (attuale && attuale.length + parte.length > LUNGHEZZA_MASSIMA) {
        pezzi.push(attuale.trim());
        attuale = "";
      }
      attuale += parte;
    }
  }
  if (attuale.trim()) pezzi.push(attuale.trim());
  return pezzi;
}

/** Frammenti di al massimo ~1200 caratteri, ognuno preceduto dal titolo del documento. */
export function dividiInFrammenti(titolo: string, testo: string): string[] {
  const paragrafi = normalizzaTesto(testo).split(/\n\s*\n/).flatMap((p) => spezzaLungo(p.trim())).filter(Boolean);
  const frammenti: string[] = [];
  let attuale = "";
  for (const p of paragrafi) {
    if (attuale && attuale.length + p.length + 2 > LUNGHEZZA_MASSIMA) {
      frammenti.push(attuale);
      attuale = "";
    }
    attuale = attuale ? `${attuale}\n\n${p}` : p;
  }
  if (attuale) frammenti.push(attuale);
  return frammenti.map((f) => `${titolo.trim()}\n${f}`);
}
