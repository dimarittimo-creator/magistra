import { randomInt } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Strumenti comuni dei test: database locale con chiave di servizio, casella email di prova (Mailpit).

const URL_DB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(URL_DB)) {
  throw new Error("I test girano solo sul database locale: avvia «npm run db:start» e «npm run db:env».");
}
export const db = createClient(URL_DB, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export const suffisso = () => `${Date.now().toString(36)}${randomInt(1000)}`;

export function password() {
  return `Prova${randomInt(100000, 999999)}x`;
}

/** Partita IVA casuale con carattere di controllo corretto. */
export function partitaIva(): string {
  const base = Array.from({ length: 10 }, () => randomInt(10)).join("");
  let somma = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(base[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    somma += d;
  }
  return base + ((10 - (somma % 10)) % 10);
}

/** Attende un'email per l'indirizzo indicato con l'oggetto che contiene il testo; restituisce l'HTML. */
export async function attendiEmail(a: string, oggetto: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${a}"`)}`);
    const { messages } = (await r.json()) as { messages: { ID: string; Subject: string }[] };
    const trovato = messages.find((m) => m.Subject.includes(oggetto));
    if (trovato) {
      const m = await (await fetch(`${MAILPIT}/api/v1/message/${trovato.ID}`)).json();
      return m.HTML as string;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Nessuna email «${oggetto}» per ${a}`);
}

export function linkDaEmail(html: string, contiene: string): string {
  const link = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")).find((h) => h.includes(contiene));
  if (!link) throw new Error(`Link con «${contiene}» non trovato nell'email`);
  return link;
}

export async function accedi(page: Page, email: string, pwd: string) {
  await page.goto("/accesso");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(pwd);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
}

export async function esci(page: Page) {
  await page.getByRole("button", { name: "Esci" }).click();
  await expect(page).toHaveURL("/");
}

/** Crea un amministratore usa e getta; restituisce credenziali e funzione di pulizia. */
export async function creaAdminTemporaneo() {
  const email = `e2e-admin-${suffisso()}@magistra.test`;
  const pwd = password();
  const { data, error } = await db.auth.admin.createUser({ email, password: pwd, email_confirm: true });
  if (error) throw error;
  await db.from("profili_utente").insert({ id: data.user.id, ruolo: "admin", nome: "Admin dei test", email });
  return { email, password: pwd, elimina: () => db.auth.admin.deleteUser(data.user.id) };
}

/** Cancella farmacia e account creati da un test (solo database locale). */
export async function eliminaFarmaciaDiTest(email: string) {
  const { data: profilo } = await db.from("profili_utente").select("id, farmacia_id").eq("email", email).maybeSingle();
  if (!profilo) return;
  await db.auth.admin.deleteUser(profilo.id);
  if (profilo.farmacia_id) await db.from("farmacie").delete().eq("id", profilo.farmacia_id);
}
