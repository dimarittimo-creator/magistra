import { expect, test } from "@playwright/test";
import {
  accedi,
  attendiEmail,
  creaAdminTemporaneo,
  db,
  eliminaFarmaciaDiTest,
  esci,
  linkDaEmail,
  partitaIva,
  password,
  suffisso,
} from "./supporto";

// Criteri di accettazione della Fase 1 (docs/FASI.md).

let admin: Awaited<ReturnType<typeof creaAdminTemporaneo>>;
const farmacieCreate: string[] = [];

test.beforeAll(async () => {
  admin = await creaAdminTemporaneo();
});

test.afterAll(async () => {
  for (const email of farmacieCreate) await eliminaFarmaciaDiTest(email);
  await admin.elimina();
});

test("una farmacia si iscrive, non vede prezzi; l'admin la approva; la farmacia entra nell'area riservata", async ({ browser }) => {
  const id = suffisso();
  const email = `e2e-farmacia-${id}@magistra.test`;
  const pwd = password();
  const ragioneSociale = `Farmacia E2E ${id}`;
  farmacieCreate.push(email);

  const farmacia = await (await browser.newContext()).newPage();

  // Iscrizione
  await farmacia.goto("/registrazione");
  await farmacia.getByLabel("Ragione sociale").fill(ragioneSociale);
  await farmacia.getByLabel("Partita IVA").fill(partitaIva());
  await farmacia.getByLabel("Titolare").fill("Titolare di prova");
  await farmacia.getByLabel("Codice destinatario SDI").fill("ABC1234");
  await farmacia.getByLabel("Email (per accedere").fill(email);
  await farmacia.getByLabel("Telefono").fill("081 1234567");
  await farmacia.getByLabel("Via e numero civico").fill("Via Roma, 1");
  await farmacia.getByLabel("CAP").fill("80100");
  await farmacia.getByLabel("Città").fill("Napoli");
  await farmacia.getByLabel("Provincia").fill("NA");
  await farmacia.getByRole("textbox", { name: "Password", exact: true }).fill(pwd);
  await farmacia.getByLabel("Ripeti la password").fill(pwd);
  await farmacia.getByLabel("Ho letto").check();
  await farmacia.getByLabel("Accetto le").check();
  await farmacia.getByRole("button", { name: "Invia la richiesta di iscrizione" }).click();
  await expect(farmacia).toHaveURL("/registrazione/inviata");

  // Prima della conferma dell'email non si entra
  await accedi(farmacia, email, pwd);
  await expect(farmacia.getByText("Non hai ancora confermato il tuo indirizzo email")).toBeVisible();

  // Conferma dall'email
  const conferma = await attendiEmail(email, "Conferma il tuo indirizzo email");
  await farmacia.goto(linkDaEmail(conferma, "/auth/conferma"));
  await expect(farmacia).toHaveURL("/farmacia");
  await expect(farmacia.getByText("Iscrizione in attesa di approvazione")).toBeVisible();
  await expect(farmacia.getByText("Iscrizione attiva")).toHaveCount(0);
  // Codice farmacia assegnato dal portale: progressivo numerico da 0100
  const codice = await farmacia.locator("dt", { hasText: "Codice farmacia" }).locator("xpath=following-sibling::dd[1]").innerText();
  expect(Number(codice)).toBeGreaterThanOrEqual(100);
  expect(codice).toMatch(/^\d{4,}$/);

  // L'amministrazione riceve la notifica (senza destinatari impostati va a tutti gli admin) e approva
  await attendiEmail(admin.email, `Nuova iscrizione da approvare: ${ragioneSociale}`);
  const pagAdmin = await (await browser.newContext()).newPage();
  await accedi(pagAdmin, admin.email, admin.password);
  await expect(pagAdmin).toHaveURL("/admin");
  await pagAdmin.goto("/admin/farmacie?stato=in_attesa");
  await pagAdmin.getByRole("link", { name: ragioneSociale }).click();
  await pagAdmin.getByRole("button", { name: "Approva l'iscrizione" }).click();
  await expect(pagAdmin.getByText("Iscrizione approvata")).toBeVisible();
  await expect(pagAdmin.locator("header").getByText("Attiva", { exact: true })).toBeVisible();
  await attendiEmail(email, "Iscrizione approvata");

  // La farmacia vede l'area riservata attiva e non può entrare nell'amministrazione
  await farmacia.reload();
  await expect(farmacia.getByText("Iscrizione attiva")).toBeVisible();
  await farmacia.goto("/admin");
  await expect(farmacia).toHaveURL("/farmacia");

  // Il registro operazioni contiene l'approvazione
  await pagAdmin.goto("/admin/registro");
  await expect(pagAdmin.getByRole("row", { name: new RegExp(`Iscrizione approvata.*${ragioneSociale}`) })).toBeVisible();

  // Blocco: la farmacia torna a non vedere il catalogo
  await pagAdmin.goto("/admin/farmacie?stato=attiva");
  await pagAdmin.getByRole("link", { name: ragioneSociale }).click();
  await pagAdmin.getByRole("button", { name: "Blocca la farmacia" }).click();
  await pagAdmin.getByLabel("Motivo").fill("Prova automatica");
  await pagAdmin.getByRole("button", { name: "Conferma il blocco" }).click();
  await expect(pagAdmin.getByText("Farmacia bloccata")).toBeVisible();
  await farmacia.goto("/farmacia");
  await expect(farmacia.getByText("Account non attivo")).toBeVisible();
  await esci(farmacia);
});

test("recupero password dall'email", async ({ page }) => {
  const id = suffisso();
  const email = `e2e-recupero-${id}@magistra.test`;
  farmacieCreate.push(email);
  const { data } = await db.auth.admin.createUser({ email, password: password(), email_confirm: true });
  const piva = partitaIva();
  const indirizzo = { indirizzo: "Via Roma 1", cap: "80100", citta: "Napoli", provincia: "NA" };
  const { error } = await db.rpc("registra_farmacia", {
    p_utente: data.user!.id,
    p_email: email,
    p_farmacia: {
      ragione_sociale: `Farmacia Recupero ${id}`,
      titolare: "Titolare",
      partita_iva: piva,
      codice_fiscale: piva,
      sdi: "ABC1234",
      telefono: "081 1234567",
    },
    p_consegna: indirizzo,
    p_fatturazione: indirizzo,
    p_marketing: false,
    p_ip: null,
    p_user_agent: "e2e",
  });
  if (error) throw error;

  await page.goto("/accesso");
  await page.getByRole("link", { name: "Password dimenticata?" }).click();
  await expect(page.getByRole("heading", { name: "Password dimenticata" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Invia il link" }).click();
  await expect(page.getByText("Se l'indirizzo è registrato")).toBeVisible();

  const html = await attendiEmail(email, "Reimposta la password");
  await page.goto(linkDaEmail(html, "/auth/conferma"));
  await expect(page).toHaveURL("/nuova-password");
  const nuova = password();
  await page.getByRole("textbox", { name: "Nuova password", exact: true }).fill(nuova);
  await page.getByLabel("Ripeti la nuova password").fill(nuova);
  await page.getByRole("button", { name: "Salva la nuova password" }).click();
  await expect(page).not.toHaveURL(/nuova-password/);

  await esci(page);
  await accedi(page, email, nuova);
  await expect(page).not.toHaveURL(/accesso/);
});

test("l'admin modifica un dato di una società e lo ritrova nello storico; un IBAN errato non si salva", async ({ page }) => {
  await accedi(page, admin.email, admin.password);
  await expect(page).toHaveURL("/admin");
  await page.goto("/admin/societa");
  const scheda = page.locator("article", { hasText: "Bioeleva" });
  await scheda.getByRole("link", { name: "Modifica" }).click();

  // IBAN con cifra di controllo sbagliata
  const campoIban = page.getByLabel("IBAN per bonifico");
  const ibanOriginale = await campoIban.inputValue();
  await campoIban.fill("IBAN-RIMOSSO");
  await page.getByRole("button", { name: "Salva le modifiche" }).click();
  await expect(page.getByText("IBAN non valido")).toBeVisible();
  const { data: bioeleva } = await db.from("societa").select("iban").eq("codice", "bioeleva").single();
  expect(bioeleva?.iban?.replace(/\s/g, "")).toBe(ibanOriginale.replace(/\s/g, ""));

  // Modifica del telefono e verifica nello storico
  await page.reload();
  const campoTelefono = page.getByLabel("Telefono");
  const telefonoOriginale = await campoTelefono.inputValue();
  const nuovoTelefono = `081 ${Date.now().toString().slice(-7)}`;
  await campoTelefono.fill(nuovoTelefono);
  await page.getByRole("button", { name: "Salva le modifiche" }).click();
  await expect(page.getByText("Dati della società salvati")).toBeVisible();
  const storico = page.locator("section", { hasText: "Storico delle modifiche" });
  await expect(storico.getByText(`Telefono:`).first()).toBeVisible();
  await expect(storico.getByText(nuovoTelefono).first()).toBeVisible();

  // Ripristino del valore iniziale
  await page.getByLabel("Telefono").fill(telefonoOriginale);
  await page.getByRole("button", { name: "Salva le modifiche" }).click();
  await expect(page.getByText("Dati della società salvati")).toBeVisible();
});

test("l'admin modifica una sede e la ritrova nello storico", async ({ page }) => {
  await accedi(page, admin.email, admin.password);
  await expect(page).toHaveURL("/admin");
  await page.goto("/admin/sedi");
  await page.getByRole("link", { name: "Deposito CIENNE" }).click();
  const orari = page.getByLabel("Orari");
  const originale = await orari.inputValue();
  const nuovo = `Lun-Ven 8-17 (prova ${suffisso()})`;
  await orari.fill(nuovo);
  await page.getByRole("button", { name: "Salva le modifiche" }).click();
  await expect(page.getByText("Sede salvata")).toBeVisible();
  await expect(page.locator("section", { hasText: "Storico delle modifiche" }).getByText(nuovo)).toBeVisible();
  await page.getByLabel("Orari").fill(originale);
  await page.getByRole("button", { name: "Salva le modifiche" }).click();
  await expect(page.getByText("Sede salvata")).toBeVisible();
});
