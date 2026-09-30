import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { accedi, attendiEmail, creaAdminTemporaneo, creaFarmaciaAttiva, creaProdottoDiTest, db, linkDaEmail, suffisso } from "./supporto";

// Fase 6 – assistente (chatbot). I test usano la "modalità di prova" (cookie magistra_assistente=prova):
// risposte simulate che chiamano gli stessi strumenti del modello vero, senza costi e sempre uguali.

let admin: Awaited<ReturnType<typeof creaAdminTemporaneo>>;
let farmacia: Awaited<ReturnType<typeof creaFarmaciaAttiva>>;
let prodotto: Awaited<ReturnType<typeof creaProdottoDiTest>>;

test.beforeAll(async () => {
  admin = await creaAdminTemporaneo();
  farmacia = await creaFarmaciaAttiva("Farmacia Chat");
  prodotto = await creaProdottoDiTest(40);
});
test.afterAll(async () => {
  await db.from("kb_documenti").delete().like("titolo", "FAQ E2E %");
  await farmacia.elimina();
  await prodotto.elimina();
  await admin.elimina();
});

async function paginaFarmacia(browser: Browser) {
  const contesto = await browser.newContext();
  await contesto.addCookies([{ name: "magistra_assistente", value: "prova", url: "http://localhost:3000" }]);
  const page = await contesto.newPage();
  await accedi(page, farmacia.email, farmacia.password);
  await expect(page).toHaveURL("/farmacia");
  return page;
}

async function apriChat(page: Page) {
  await page.getByRole("button", { name: "Assistente" }).click();
  return page.getByRole("dialog", { name: "Assistente Magistra" });
}

/** Aspetta che la chat abbia caricato; con `nuova` chiude la conversazione in corso e ne apre un'altra. */
async function pronta(chat: ReturnType<Page["getByRole"]>, nuova = false) {
  const campo = chat.getByLabel("Messaggio per l'assistente");
  const inizia = chat.getByRole("button", { name: "Ho letto, inizia la conversazione" });
  await expect(campo.or(inizia)).toBeVisible();
  if (nuova && (await campo.isVisible())) await chat.getByRole("button", { name: "Nuova conversazione" }).click();
  if (nuova || (await inizia.isVisible())) await inizia.click();
  await expect(campo).toBeVisible();
}

async function scrivi(chat: ReturnType<Page["getByRole"]>, testo: string) {
  const risposte = chat.getByText("Assistente virtuale (IA) ·");
  await expect(chat.getByLabel("Messaggio per l'assistente")).toBeEnabled(); // conversazione caricata
  const prima = await risposte.count();
  await chat.getByLabel("Messaggio per l'assistente").fill(testo);
  await chat.getByRole("button", { name: "Invia" }).click();
  await expect(risposte).toHaveCount(prima + 1);
}

test("all'apertura: informativa e dichiarazione AI; disponibilità dal database; carrello solo dopo conferma", async ({ browser }) => {
  const page = await paginaFarmacia(browser);
  const chat = await apriChat(page);

  // Informativa GDPR e trasparenza AI prima di poter scrivere
  await expect(chat.getByText("assistente virtuale basato su intelligenza artificiale").first()).toBeVisible();
  await expect(chat.getByRole("link", { name: "Informativa privacy" })).toBeVisible();
  await expect(chat.getByText("salvata per 24 mesi")).toBeVisible();
  await expect(chat.getByLabel("Messaggio per l'assistente")).toHaveCount(0);
  await chat.getByRole("button", { name: "Ho letto, inizia la conversazione" }).click();
  await expect(chat.getByText("Sono l'assistente virtuale di Magistra")).toBeVisible();
  await expect(chat.getByText("Modalità di prova")).toBeVisible();

  // Disponibilità e lotti letti dal database
  await scrivi(chat, `Che disponibilità c'è del prodotto ${prodotto.codice}?`);
  await expect(chat.getByText(new RegExp(`Lotto ${prodotto.codiceLotto}, scadenza .*: 40 pezzi`))).toBeVisible();

  // Proposta: niente nel carrello finché la farmacia non conferma
  await scrivi(chat, `Aggiungi 5 pezzi del prodotto ${prodotto.codice}`);
  const proposta = chat.locator("[data-proposta]").last();
  await expect(proposta.getByText("Da confermare")).toBeVisible();
  await expect(proposta.getByText(`Lotto ${prodotto.codiceLotto}`)).toBeVisible();
  const { data: primaDellaConferma } = await db.from("carrello_righe").select("quantita").eq("farmacia_id", farmacia.farmaciaId);
  expect(primaDellaConferma).toEqual([]);

  await proposta.getByRole("button", { name: "Conferma" }).click();
  await expect(proposta.getByText("Aggiunta al carrello")).toBeVisible();
  await expect(chat.getByRole("status")).toContainText("Nel carrello: 5 pezzi");
  const { data: dopo } = await db.from("carrello_righe").select("lotto_id, quantita").eq("farmacia_id", farmacia.farmaciaId);
  expect(dopo).toEqual([{ lotto_id: prodotto.lottoId, quantita: 5 }]);
  await expect(page.getByRole("link", { name: "Carrello (1)" })).toBeVisible();

  // Una proposta annullata non cambia il carrello
  await scrivi(chat, `Aggiungi 3 pezzi del prodotto ${prodotto.codice}`);
  const seconda = chat.locator("[data-proposta]").last();
  await seconda.getByRole("button", { name: "Annulla" }).click();
  await expect(seconda.getByText("Annullata")).toBeVisible();
  const { data: finale } = await db.from("carrello_righe").select("quantita").eq("farmacia_id", farmacia.farmaciaId);
  expect(finale).toEqual([{ quantita: 5 }]);

  // Un prodotto che non esiste non viene inventato
  await scrivi(chat, "Aggiungi 2 pezzi del prodotto 99999999");
  await expect(chat.getByText("non è nel catalogo: nessuna proposta creata")).toBeVisible();
  await expect(chat.locator("[data-proposta]")).toHaveCount(2);

  // Nessun consiglio sul singolo paziente
  await scrivi(chat, "Posso dare questo integratore a una paziente in gravidanza?");
  await expect(chat.getByText("serve il parere del medico")).toBeVisible();
});

test("base di conoscenza: l'assistente usa solo i testi approvati; le domande senza risposta si registrano", async ({ browser }) => {
  const parola = `zafferanox${suffisso()}`;
  const pa = await (await browser.newContext()).newPage();
  await accedi(pa, admin.email, admin.password);
  await expect(pa).toHaveURL("/admin");
  await pa.goto("/admin/assistente/conoscenza/nuovo");
  await pa.getByLabel("Titolo").fill(`FAQ E2E ${parola}`);
  await pa.getByLabel("Tipo").selectOption("faq");
  await pa.getByLabel("Destinatari").selectOption("farmacie");
  await pa.getByLabel("Testo").fill(`Che cos'è ${parola}? È una parola inventata per i test automatici di Magistra.\n\nSecondo paragrafo di prova.`);
  await pa.getByRole("button", { name: "Crea documento (in bozza)" }).click();
  await expect(pa.getByText("Bozza – non usato")).toBeVisible();

  const page = await paginaFarmacia(browser);
  const chat = await apriChat(page);
  await pronta(chat);

  // In bozza: l'assistente non lo usa, registra la domanda
  await scrivi(chat, parola);
  await expect(chat.getByText("Non ho informazioni approvate su questo argomento").last()).toBeVisible();
  const { data: domande } = await db.from("domande_senza_risposta").select("domanda").ilike("domanda", `%${parola}%`);
  expect(domande?.length).toBe(1);

  // Approvato: l'assistente risponde con il testo approvato
  await pa.getByRole("button", { name: "Approva e rendi disponibile all'assistente" }).click();
  await expect(pa.getByText("Approvato – in uso")).toBeVisible();
  await scrivi(chat, parola);
  await expect(chat.getByText("È una parola inventata per i test automatici di Magistra")).toBeVisible();

  // Una modifica lo rimette in bozza
  await pa.getByLabel("Testo").fill(`Che cos'è ${parola}? Testo cambiato.`);
  await pa.getByRole("button", { name: "Salva modifiche" }).click();
  await expect(pa.getByText("È tornato in bozza")).toBeVisible();

  // Pannello domande senza risposta
  await pa.goto("/admin/assistente/domande");
  await expect(pa.getByText(parola).first()).toBeVisible();
});

test("passaggio a operatore: avviso email, risposta dal pannello nella stessa chat", async ({ browser }) => {
  const page = await paginaFarmacia(browser);
  const chat = await apriChat(page);
  await pronta(chat, true);
  await scrivi(chat, "Ho un problema con una fattura");
  await chat.getByRole("button", { name: "Parla con un operatore" }).click();
  await expect(chat.getByText("Ho avvisato un operatore")).toBeVisible();
  await expect(chat.getByText("In attesa di un operatore")).toBeVisible();
  await expect(chat.getByRole("button", { name: "Nuova conversazione" })).toHaveCount(0);

  const avviso = await attendiEmail(admin.email, `Richiesta di assistenza in chat: ${farmacia.ragioneSociale}`);
  const pa = await (await browser.newContext()).newPage();
  await accedi(pa, admin.email, admin.password);
  await expect(pa).toHaveURL("/admin");
  await pa.goto(new URL(linkDaEmail(avviso, "/admin/assistente/")).pathname);
  await expect(pa.getByText("Ho un problema con una fattura")).toBeVisible();
  await pa.getByLabel("Risposta al cliente").fill("Buongiorno, verifico subito la fattura e le scrivo qui.");
  await pa.getByRole("button", { name: "Invia risposta" }).click();
  await expect(pa.getByText("Risposta inviata. Richiesta chiusa")).toBeVisible();

  await attendiEmail(farmacia.email, "Hai una risposta dal nostro operatore");
  await page.reload();
  const chat2 = await apriChat(page);
  await expect(chat2.getByText("Operatore Magistra ·")).toBeVisible();
  await expect(chat2.getByText("verifico subito la fattura")).toBeVisible();

  // Il messaggio successivo torna all'assistente, che riceve anche la risposta dell'operatore
  await scrivi(chat2, "Quali promozioni ci sono?");
  const { data: ultimo } = await db.from("messaggi").select("api").eq("ruolo", "utente").order("id", { ascending: false }).limit(1).single();
  expect(JSON.stringify(ultimo!.api)).toContain("Risposta dell'operatore di Magistra: Buongiorno, verifico subito la fattura");
});

test("riservatezza, limiti di frequenza e cancellazione dopo il periodo di conservazione", async ({ browser }) => {
  const { data: conv } = await db.from("conversazioni").select("id").eq("farmacia_id", farmacia.farmaciaId).neq("stato", "chiusa").limit(1).single();

  // Un'altra farmacia non vede le conversazioni altrui (RLS)
  const altra = await creaFarmaciaAttiva("Farmacia Curiosa");
  try {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    await client.auth.signInWithPassword({ email: altra.email, password: altra.password });
    const [{ data: c }, { data: m }, { data: k }] = await Promise.all([
      client.from("conversazioni").select("id"),
      client.from("messaggi").select("id"),
      client.from("kb_documenti").select("id"),
    ]);
    expect(c).toEqual([]);
    expect(m).toEqual([]);
    expect(k).toEqual([]);
    // E non può scrivere messaggi a nome dell'assistente
    const { error } = await client.from("messaggi").insert({ conversazione_id: conv!.id, ruolo: "assistente", testo: "falso" });
    expect(error).not.toBeNull();
  } finally {
    await altra.elimina();
  }

  // Limite di frequenza: troppi messaggi in 5 minuti
  await db.from("messaggi").insert(Array.from({ length: 15 }, () => ({ conversazione_id: conv!.id, ruolo: "utente", testo: "riempitivo" })));
  const page = await paginaFarmacia(browser);
  const chat = await apriChat(page);
  await chat.getByLabel("Messaggio per l'assistente").fill("Ancora una domanda");
  await chat.getByRole("button", { name: "Invia" }).click();
  await expect(chat.getByRole("alert")).toContainText("molti messaggi in poco tempo");

  // Conservazione: oltre i mesi impostati la conversazione si cancella
  await db.from("conversazioni").update({ ultimo_messaggio_il: new Date(Date.now() - 25 * 31 * 86400_000).toISOString() }).eq("id", conv!.id);
  const r = await fetch("http://localhost:3000/api/cron/scadenze", { headers: process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {} });
  expect(r.ok).toBe(true);
  const { data: rimasta } = await db.from("conversazioni").select("id").eq("id", conv!.id);
  expect(rimasta).toEqual([]);
});
