import { expect, test, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { accedi, attendiEmail, creaAdminTemporaneo, creaFarmaciaAttiva, creaProdottoDiTest, db, linkDaEmail, password, suffisso } from "./supporto";

// Fase 8 – area Medici (docs/AREA_MEDICI.md): iscrizione con approvazione, schede senza prezzi,
// materiale scientifico riservato, richieste di campioni, assistente senza dati commerciali.

let admin: Awaited<ReturnType<typeof creaAdminTemporaneo>>;
let prodotto: Awaited<ReturnType<typeof creaProdottoDiTest>>;
const mediciCreati: string[] = [];

test.beforeAll(async () => {
  admin = await creaAdminTemporaneo();
  prodotto = await creaProdottoDiTest(30);
  await db.from("prodotti").update({ descrizione: "Integratore di prova con magnesio" }).eq("codice", prodotto.codice);
});
test.afterAll(async () => {
  await db.from("kb_documenti").delete().like("titolo", "E2E medici %");
  const { data: materiali } = await db.from("materiali_medici").select("id, file_path").like("titolo", "E2E %");
  for (const m of materiali ?? []) await db.storage.from("materiali").remove([m.file_path]);
  await db.from("materiali_medici").delete().like("titolo", "E2E %");
  for (const email of mediciCreati) {
    const { data: p } = await db.from("profili_utente").select("id, medico_id").eq("email", email).maybeSingle();
    if (!p) continue;
    await db.from("conversazioni").delete().eq("utente_id", p.id);
    await db.auth.admin.deleteUser(p.id);
    if (p.medico_id) await db.from("medici").delete().eq("id", p.medico_id);
  }
  await db.from("richieste_campioni").delete().eq("prodotto_codice", prodotto.codice);
  await prodotto.elimina();
  await admin.elimina();
});

/** Medico già approvato, con email confermata. */
async function creaMedicoAttivo() {
  const id = suffisso();
  const email = `e2e-medico-${id}@magistra.test`;
  const pwd = password();
  const { data, error } = await db.auth.admin.createUser({ email, password: pwd, email_confirm: true });
  if (error) throw error;
  const { data: medicoId, error: e2 } = await db.rpc("registra_medico", {
    p_utente: data.user.id,
    p_email: email,
    p_medico: { nome: "Anna", cognome: `Prova ${id}`, specializzazione: "Medicina generale", numero_iscrizione: id.slice(-10), ordine_provincia: "NA", telefono: "081 7654321", indirizzo: "Via Toledo 10", cap: "80134", citta: "Napoli", provincia: "NA" },
    p_marketing: false,
    p_ip: null,
    p_user_agent: "e2e",
  });
  if (e2) throw e2;
  await db.from("medici").update({ stato: "attivo", approvato_il: new Date().toISOString() }).eq("id", medicoId);
  mediciCreati.push(email);
  return { email, password: pwd, medicoId: medicoId as string, cognome: `Prova ${id}`, utenteId: data.user.id };
}

async function paginaMedico(browser: Browser, medico: { email: string; password: string }): Promise<Page> {
  const contesto = await browser.newContext();
  await contesto.addCookies([{ name: "magistra_assistente", value: "prova", url: "http://localhost:3000" }]);
  const page = await contesto.newPage();
  await accedi(page, medico.email, medico.password);
  await expect(page).toHaveURL("/medici");
  return page;
}

async function paginaAdmin(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await accedi(page, admin.email, admin.password);
  await expect(page).toHaveURL("/admin");
  return page;
}

test("un medico si iscrive dalla home, l'admin lo approva, poi vede le schede senza prezzi", async ({ browser }) => {
  const id = suffisso();
  const email = `e2e-medico-${id}@magistra.test`;
  const pwd = password();
  const cognome = `Iscritto ${id}`;
  mediciCreati.push(email);
  test.setTimeout(180_000);

  const page = await (await browser.newContext()).newPage();
  await page.goto("/");
  await page.getByRole("link", { name: "Entra nell'area Medici" }).click();
  await expect(page).toHaveURL("/accesso?area=medici");
  await page.getByRole("link", { name: "Richiedi l'accesso" }).click();

  // Controlli del modulo: senza iscrizione all'Ordine e dichiarazione non si invia
  await page.getByRole("button", { name: "Invia la richiesta di accesso" }).click();
  await expect(page.getByText("Indica il numero di iscrizione all'Ordine")).toBeVisible();
  await expect(page.getByText("Serve la dichiarazione di iscrizione all'Ordine")).toBeVisible();

  await page.locator("#campo-nome").fill("Mario");
  await page.getByLabel("Cognome").fill(cognome);
  await page.getByLabel("Specializzazione").fill("Ginecologia");
  await page.getByLabel("Telefono").fill("081 1234567");
  await page.locator("#campo-email").fill(email);
  await page.getByLabel("Numero di iscrizione").fill(id.slice(-10));
  await page.getByLabel("Provincia dell'Ordine").fill("na");
  await page.getByLabel("Via e numero civico").fill("Via Chiaia 5");
  await page.getByLabel("CAP").fill("80121");
  await page.getByLabel("Città").fill("Napoli");
  await page.locator("#campo-studio_provincia").fill("NA");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(pwd);
  await page.getByLabel("Ripeti la password").fill(pwd);
  await page.getByLabel("Dichiaro di essere medico").check();
  await page.getByLabel("Ho letto").check();
  await page.getByRole("button", { name: "Invia la richiesta di accesso" }).click();
  await expect(page).toHaveURL("/registrazione/inviata?tipo=medico");
  await expect(page.getByText("Verifichiamo l'iscrizione all'Ordine dei Medici")).toBeVisible();

  // Conferma dell'email: il medico entra ma i contenuti sono chiusi
  await attendiEmail(email, "Richiesta di accesso all'area Medici ricevuta");
  const conferma = await attendiEmail(email, "Conferma il tuo indirizzo email");
  await page.goto(linkDaEmail(conferma, "/auth/conferma"));
  await expect(page).toHaveURL("/medici");
  await expect(page.getByText("Accesso in attesa di approvazione")).toBeVisible();
  await expect(page.getByRole("link", { name: "Schede prodotto" })).toHaveCount(0);
  await page.goto("/medici/prodotti");
  await expect(page).toHaveURL("/medici");
  await expect(page.getByRole("button", { name: "Assistente" })).toHaveCount(0);

  // L'amministrazione riceve l'avviso e approva
  await attendiEmail(admin.email, `Nuovo medico da approvare: Mario ${cognome}`);
  const pagAdmin = await paginaAdmin(browser);
  await expect(pagAdmin.getByRole("link", { name: /Medici da approvare/ })).toBeVisible();
  await pagAdmin.goto("/admin/medici?stato=in_attesa");
  await pagAdmin.getByRole("link", { name: `${cognome} Mario` }).click();
  await expect(pagAdmin.getByText("Ordine di NA, n.")).toBeVisible();
  await pagAdmin.getByRole("button", { name: "Approva l'accesso" }).click();
  await expect(pagAdmin.getByText("Accesso approvato")).toBeVisible();
  await attendiEmail(email, "Accesso all'area Medici attivo");
  await pagAdmin.goto("/admin/registro");
  await expect(pagAdmin.getByRole("row", { name: new RegExp(`Medico approvato.*${cognome}`) })).toBeVisible();

  // Schede prodotto: nessun prezzo, nessun lotto
  await page.reload();
  await page.getByRole("link", { name: "Schede prodotto" }).first().click();
  await page.getByLabel("Cerca").fill(prodotto.codice);
  await page.getByRole("button", { name: "Cerca" }).click();
  await page.getByRole("link", { name: `Prodotto di prova ${prodotto.codice}` }).click();
  await expect(page.getByText("Integratore di prova con magnesio")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("€");
  await expect(page.locator("main")).not.toContainText(prodotto.codiceLotto);

  // Un medico non entra nelle aree farmacia e amministrazione
  await page.goto("/farmacia/catalogo");
  await expect(page).toHaveURL("/medici");
  await page.goto("/admin");
  await expect(page).toHaveURL("/medici");
});

test("il medico non legge dal database prezzi, lotti né materiale in bozza", async () => {
  const medico = await creaMedicoAttivo();
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await anon.auth.signInWithPassword({ email: medico.email, password: medico.password });
  expect(error).toBeNull();
  const [{ data: prodotti }, { data: lotti }, { data: ordini }, { data: farmacie }] = await Promise.all([
    anon.from("prodotti").select("codice, prezzo_pubblico_cent"),
    anon.from("lotti").select("id"),
    anon.from("ordini").select("id"),
    anon.from("farmacie").select("id"),
  ]);
  expect(prodotti).toEqual([]);
  expect(lotti).toEqual([]);
  expect(ordini).toEqual([]);
  expect(farmacie).toEqual([]);
  // Lo stato e i dati identificativi li cambia solo l'amministrazione
  const { error: e1 } = await anon.from("medici").update({ stato: "attivo", numero_iscrizione: "999" }).eq("id", medico.medicoId);
  expect(e1?.message).toContain("solo dall'amministrazione");
  // L'archivio dei PDF non è leggibile direttamente
  const { data: file } = await anon.storage.from("materiali").list();
  expect(file ?? []).toEqual([]);
});

test("materiale scientifico: l'admin carica un PDF in bozza, lo pubblica e il medico lo scarica", async ({ browser }) => {
  const medico = await creaMedicoAttivo();
  const titolo = `E2E Studio ${suffisso()}`;
  const pagAdmin = await paginaAdmin(browser);
  await pagAdmin.goto("/admin/medici/materiale");
  await pagAdmin.getByLabel("Titolo").fill(titolo);
  await pagAdmin.getByLabel("Prodotto collegato").selectOption(prodotto.codice);
  await pagAdmin.getByLabel("File PDF").setInputFiles({ name: "studio.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% studio di prova\n%%EOF\n") });
  await pagAdmin.getByRole("button", { name: "Carica il documento" }).click();
  await expect(pagAdmin.getByText("Documento caricato in bozza")).toBeVisible();
  const riga = pagAdmin.getByRole("row", { name: new RegExp(titolo) });
  await expect(riga.getByText("Bozza")).toBeVisible();
  const { data: m } = await db.from("materiali_medici").select("id").eq("titolo", titolo).single();

  // In bozza il medico non lo vede né lo scarica
  const page = await paginaMedico(browser, medico);
  await page.goto("/medici/materiale");
  await expect(page.getByText(titolo)).toHaveCount(0);
  expect((await page.request.get(`/api/materiali/${m!.id}`)).status()).toBe(404);

  // Un file che non è un PDF viene rifiutato
  await pagAdmin.getByLabel("Titolo").fill("E2E Falso");
  await pagAdmin.getByLabel("File PDF").setInputFiles({ name: "falso.pdf", mimeType: "application/pdf", buffer: Buffer.from("non sono un pdf") });
  await pagAdmin.getByRole("button", { name: "Carica il documento" }).click();
  await expect(pagAdmin.getByText("Il file non è un PDF valido")).toBeVisible();

  // Pubblicato: visibile nell'elenco e nella scheda del prodotto, scaricabile
  await riga.getByRole("button", { name: "Pubblica" }).click();
  await expect(riga.getByText("Pubblicato")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: titolo })).toBeVisible();
  const download = await page.request.get(`/api/materiali/${m!.id}`);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-type"]).toBe("application/pdf");
  expect((await download.body()).subarray(0, 4).toString()).toBe("%PDF");
  await page.goto(`/medici/prodotti/${prodotto.codice}`);
  await expect(page.getByRole("link", { name: titolo })).toBeVisible();

  // Senza accesso da medico il download è negato
  const estraneo = await (await browser.newContext()).newPage();
  expect((await estraneo.request.get(`/api/materiali/${m!.id}`)).status()).toBe(403);
});

test("campioni: il medico li richiede, l'admin li segna spediti e il medico riceve l'email", async ({ browser }) => {
  const medico = await creaMedicoAttivo();
  const page = await paginaMedico(browser, medico);
  await page.goto(`/medici/prodotti/${prodotto.codice}`);
  await page.getByRole("link", { name: "Richiedi campioni" }).click();
  await expect(page.getByText("Spediamo all'indirizzo dello studio: Via Toledo 10")).toBeVisible();
  await page.getByLabel("Confezioni").fill("99");
  await page.getByRole("button", { name: "Invia la richiesta" }).click();
  await expect(page.getByText("Da 1 a 5 confezioni")).toBeVisible();
  await page.getByLabel("Prodotto").selectOption(prodotto.codice);
  await page.getByLabel("Confezioni").fill("3");
  await page.getByLabel("Note").fill("Consegna al mattino");
  await page.getByRole("button", { name: "Invia la richiesta" }).click();
  await expect(page.getByText(`Richiesta inviata: 3 confezioni di Prodotto di prova ${prodotto.codice}`)).toBeVisible();
  await expect(page.getByText("Ricevuta")).toBeVisible();

  // Una seconda richiesta per lo stesso prodotto aspetta la prima
  await page.getByLabel("Prodotto").selectOption(prodotto.codice);
  await page.getByRole("button", { name: "Invia la richiesta" }).click();
  await expect(page.getByText("Ha già una richiesta in corso")).toBeVisible();

  await attendiEmail(admin.email, `Richiesta campioni: Prodotto di prova ${prodotto.codice} (Dott. ${medico.cognome})`);
  const pagAdmin = await paginaAdmin(browser);
  await pagAdmin.goto("/admin/medici/campioni");
  const scheda = pagAdmin.getByRole("listitem").filter({ hasText: medico.cognome });
  await expect(scheda.getByText("Spedire a: Dott. Anna")).toBeVisible();
  await scheda.getByLabel("Nuovo stato").selectOption("spedita");
  await scheda.getByLabel("Messaggio al medico").fill("Corriere BRT, spedizione 123");
  await scheda.getByRole("button", { name: "Aggiorna" }).click();
  // Gestita: esce dall'elenco «Da gestire»
  await expect(scheda).toHaveCount(0);
  await attendiEmail(medico.email, `Richiesta campioni Prodotto di prova ${prodotto.codice}`);

  await page.reload();
  await expect(page.getByText("Spedita", { exact: true })).toBeVisible();
  await expect(page.getByText("Messaggio di Magistra: Corriere BRT, spedizione 123")).toBeVisible();
});

test("assistente dei medici: solo informazioni approvate per i medici, niente prezzi", async ({ browser }) => {
  const medico = await creaMedicoAttivo();
  const parola = `zafferanina${suffisso()}`;
  await db.from("kb_documenti").insert([
    { titolo: "E2E medici scheda", pubblico: "medici", stato: "approvato", testo: `Il ${parola} è indicato nella scheda approvata per i medici.` },
    { titolo: "E2E medici solo farmacie", pubblico: "farmacie", stato: "approvato", testo: `Testo riservato alle farmacie sul ${parola}farmacia.` },
  ]);
  const { data: docs } = await db.from("kb_documenti").select("id, titolo, testo").like("titolo", "E2E medici %");
  for (const d of docs ?? []) await db.from("kb_frammenti").insert({ documento_id: d.id, posizione: 0, testo: d.testo });

  const page = await paginaMedico(browser, medico);
  await page.getByRole("button", { name: "Assistente" }).click();
  const chat = page.getByRole("dialog", { name: "Assistente Magistra" });
  await expect(chat.getByText("contenuti scientifici approvati")).toBeVisible();
  await chat.getByRole("button", { name: "Ho letto, inizia la conversazione" }).click();
  await expect(chat.getByText("Sono l'assistente virtuale dell'area Medici")).toBeVisible();

  const scrivi = async (testo: string) => {
    const risposte = chat.getByText("Assistente virtuale (IA) ·");
    const prima = await risposte.count();
    await chat.getByLabel("Messaggio per l'assistente").fill(testo);
    await chat.getByRole("button", { name: "Invia" }).click();
    await expect(risposte).toHaveCount(prima + 1);
  };
  await scrivi(`Cosa sapete del ${parola}?`);
  await expect(chat.getByText("indicato nella scheda approvata per i medici")).toBeVisible();
  await scrivi(`Che prezzo ha il ${prodotto.codice}?`);
  await expect(chat.getByText("L'area Medici è informativa")).toBeVisible();
  await scrivi(`Informazioni sul ${parola}farmacia`);
  await expect(chat.getByText("Testo riservato alle farmacie")).toHaveCount(0);

  // Il pannello operatore mostra il medico
  const pagAdmin = await paginaAdmin(browser);
  await pagAdmin.goto("/admin/assistente");
  await expect(pagAdmin.getByText(`Dott. Anna ${medico.cognome} (medico)`).first()).toBeVisible();
});

test("una farmacia non entra nell'area Medici", async ({ browser }) => {
  const farmacia = await creaFarmaciaAttiva("Farmacia NoMedici");
  try {
    const page = await (await browser.newContext()).newPage();
    await accedi(page, farmacia.email, farmacia.password);
    await expect(page).toHaveURL("/farmacia");
    await page.goto("/medici/prodotti");
    await expect(page).toHaveURL("/farmacia");
  } finally {
    await farmacia.elimina();
  }
});
