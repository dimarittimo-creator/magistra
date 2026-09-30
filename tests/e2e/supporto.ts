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

/** Cancella farmacia, ordini e account creati da un test (solo database locale). */
export async function eliminaFarmaciaDiTest(email: string) {
  const { data: profilo } = await db.from("profili_utente").select("id, farmacia_id").eq("email", email).maybeSingle();
  if (!profilo) return;
  if (profilo.farmacia_id) await db.from("ordini").delete().eq("farmacia_id", profilo.farmacia_id);
  await db.auth.admin.deleteUser(profilo.id);
  if (profilo.farmacia_id) await db.from("farmacie").delete().eq("id", profilo.farmacia_id);
}

/** Farmacia già approvata, con email confermata, pronta per ordinare. */
export async function creaFarmaciaAttiva(nome: string) {
  const id = suffisso();
  const email = `e2e-${nome.toLowerCase().replace(/\W+/g, "-")}-${id}@magistra.test`;
  const pwd = password();
  const { data, error } = await db.auth.admin.createUser({ email, password: pwd, email_confirm: true });
  if (error) throw error;
  const piva = partitaIva();
  const indirizzo = { indirizzo: "Via Roma 1", cap: "80100", citta: "Napoli", provincia: "NA" };
  const { data: farmaciaId, error: e2 } = await db.rpc("registra_farmacia", {
    p_utente: data.user.id,
    p_email: email,
    p_farmacia: { ragione_sociale: `${nome} ${id}`, titolare: "Titolare di prova", partita_iva: piva, codice_fiscale: piva, sdi: "ABC1234", telefono: "081 1234567" },
    p_consegna: indirizzo,
    p_fatturazione: indirizzo,
    p_marketing: false,
    p_ip: null,
    p_user_agent: "e2e",
  });
  if (e2) throw e2;
  await db.from("farmacie").update({ stato: "attiva", approvata_il: new Date().toISOString() }).eq("id", farmaciaId);
  return { email, password: pwd, farmaciaId: farmaciaId as string, ragioneSociale: `${nome} ${id}`, elimina: () => eliminaFarmaciaDiTest(email) };
}

/**
 * Prodotto con un solo lotto sul deposito predefinito (prezzo 20,00 €, scadenza fra un anno).
 * I codici dei prodotti di prova iniziano con 000: non esistono minsan reali così.
 */
export async function creaProdottoDiTest(giacenza: number) {
  const codice = `000${String(Date.now()).slice(-6)}`;
  const codiceLotto = `E2E-${suffisso()}`;
  const { data: deposito } = await db.from("sedi").select("id").eq("predefinito", true).single();
  const scadenza = new Date();
  scadenza.setFullYear(scadenza.getFullYear() + 1);
  const oggi = new Date().toISOString().slice(0, 10);
  const { error: e0 } = await db.from("prodotti").insert({ codice, nome: `Prodotto di prova ${codice}`, prezzo_pubblico_cent: 2000 });
  if (e0) throw e0;
  await db.from("giacenze_prodotto").insert({ prodotto_codice: codice, deposito_id: deposito!.id, totale_dichiarato: giacenza, data_giacenza: oggi });
  const { data: lotto, error } = await db
    .from("lotti")
    .insert({ prodotto_codice: codice, deposito_id: deposito!.id, codice_lotto: codiceLotto, scadenza: scadenza.toISOString().slice(0, 10), giacenza, data_giacenza: oggi })
    .select("id")
    .single();
  if (error) throw error;
  return {
    codice,
    codiceLotto,
    lottoId: lotto.id as string,
    elimina: async () => {
      await db.from("carrello_righe").delete().eq("lotto_id", lotto.id);
      await db.from("lotti").delete().eq("id", lotto.id);
      await db.from("giacenze_prodotto").delete().eq("prodotto_codice", codice);
      await db.from("prodotti").delete().eq("codice", codice);
    },
  };
}

/** Compila il modulo di invio del carrello. */
export async function compilaInvio(page: Page, opzioni: { societa?: "Sagè Pharma" | "Bioeleva"; pagamento?: string; accetta?: boolean }) {
  if (opzioni.societa) await page.getByRole("radio", { name: new RegExp(opzioni.societa) }).check();
  if (opzioni.pagamento) await page.getByLabel("Modalità di pagamento").selectOption({ label: opzioni.pagamento });
  if (opzioni.accetta) await page.getByLabel("Ho letto e accetto").check();
}

/** IBAN della società come lo mostra il portale ("IT00 X000 …"), letto dal database: gli IBAN veri non stanno nel codice. */
export async function ibanSocieta(codice: "sage" | "bioeleva"): Promise<string> {
  const { data } = await db.from("societa").select("iban").eq("codice", codice).single();
  if (!data?.iban) throw new Error(`IBAN di ${codice} mancante: controlla supabase/seed_privato.sql`);
  return data.iban.replace(/s/g, "").match(/.{1,4}/g)!.join(" ");
}
