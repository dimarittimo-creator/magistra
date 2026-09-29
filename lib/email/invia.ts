import "server-only";

// Invio email transazionali.
// - Con BREVO_API_KEY: invio reale tramite Brevo (produzione).
// - Senza chiave, in sviluppo: le email finiscono nella casella di prova locale (Mailpit,
//   http://127.0.0.1:54324), la stessa che riceve le email di conferma di Supabase.
// Un errore di invio non blocca l'operazione che l'ha generato (si registra nel log),
// tranne dove l'esito conta: la funzione restituisce true/false.

export type Allegato = { nome: string; contenuto: Buffer | Uint8Array; tipo: string };
export type Email = { a: string | string[]; cc?: string[]; oggetto: string; html: string; testo: string; allegati?: Allegato[] };

const MITTENTE_PREDEFINITO = "noreply@magistra.local";

export async function inviaEmail(email: Email): Promise<boolean> {
  const destinatari = (Array.isArray(email.a) ? email.a : [email.a]).filter(Boolean);
  if (destinatari.length === 0) return false;
  const cc = (email.cc ?? []).filter((c) => c && !destinatari.includes(c));
  const mittente = process.env.EMAIL_MITTENTE || MITTENTE_PREDEFINITO;
  const base64 = (a: Allegato) => Buffer.from(a.contenuto).toString("base64");

  try {
    if (process.env.BREVO_API_KEY) {
      const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { email: mittente, name: "Magistra" },
          to: destinatari.map((a) => ({ email: a })),
          ...(cc.length ? { cc: cc.map((c) => ({ email: c })) } : {}),
          subject: email.oggetto,
          htmlContent: email.html,
          textContent: email.testo,
          ...(email.allegati?.length ? { attachment: email.allegati.map((a) => ({ name: a.nome, content: base64(a) })) } : {}),
        }),
      });
      if (!r.ok) throw new Error(`Brevo ${r.status}: ${await r.text()}`);
      return true;
    }

    if (process.env.NODE_ENV !== "production") {
      const mailpit = process.env.MAILPIT_URL || "http://127.0.0.1:54324";
      const r = await fetch(`${mailpit}/api/v1/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          From: { Email: mittente, Name: "Magistra" },
          To: destinatari.map((a) => ({ Email: a })),
          Cc: cc.map((c) => ({ Email: c })),
          Subject: email.oggetto,
          HTML: email.html,
          Text: email.testo,
          Attachments: (email.allegati ?? []).map((a) => ({ Filename: a.nome, Content: base64(a), ContentType: a.tipo })),
        }),
      });
      if (!r.ok) throw new Error(`Mailpit ${r.status}: ${await r.text()}`);
      return true;
    }

    console.warn(`[email] BREVO_API_KEY mancante: email «${email.oggetto}» non inviata`);
    return false;
  } catch (e) {
    console.error(`[email] invio non riuscito («${email.oggetto}»):`, e);
    return false;
  }
}
