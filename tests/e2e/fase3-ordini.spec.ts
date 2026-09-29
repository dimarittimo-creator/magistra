import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { accedi, attendiEmail, compilaInvio, creaAdminTemporaneo, creaFarmaciaAttiva, creaProdottoDiTest, db } from "./supporto";

// Fase 3 – ordini, deposito, DDT, fatturazione (docs/FASI.md)

let admin: Awaited<ReturnType<typeof creaAdminTemporaneo>>;
let farmacia: Awaited<ReturnType<typeof creaFarmaciaAttiva>>;
let prodotto: Awaited<ReturnType<typeof creaProdottoDiTest>>;
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

test.beforeAll(async () => {
  admin = await creaAdminTemporaneo();
  farmacia = await creaFarmaciaAttiva("Farmacia Deposito");
  prodotto = await creaProdottoDiTest(50);
});
test.afterAll(async () => {
  await farmacia.elimina();
  await prodotto.elimina();
  await admin.elimina();
});

/** La farmacia prenota `quantita` pezzi del prodotto di prova con la società indicata; restituisce id e numero. */
async function prenota(browser: Browser, quantita: number, societa: "Sagè Pharma" | "Bioeleva") {
  await db.from("carrello_righe").delete().eq("farmacia_id", farmacia.farmaciaId);
  await db.from("carrello_righe").insert({ farmacia_id: farmacia.farmaciaId, lotto_id: prodotto.lottoId, quantita });
  const page = await (await browser.newContext()).newPage();
  await accedi(page, farmacia.email, farmacia.password);
  await expect(page).toHaveURL("/farmacia");
  await page.goto("/farmacia/carrello");
  await compilaInvio(page, { societa, pagamento: "RIBA 30 giorni", accetta: true });
  await page.getByRole("button", { name: "Invia la prenotazione" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Prenotazione inviata" })).toBeVisible();
  const id = page.url().match(/ordini\/([^?]+)/)![1];
  const numero = (await page.getByRole("heading", { level: 1 }).innerText()).match(/P-\d{4}-\d{5}/)![0];
  return { id, numero, page };
}

async function adminSu(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await accedi(page, admin.email, admin.password);
  await expect(page).toHaveURL("/admin");
  return page;
}

async function confermaInviaDdt(page: Page, ordineId: string, numeroDdt: string, pdf?: string) {
  await page.goto(`/admin/ordini/${ordineId}`);
  // Dopo ogni passo la pagina mostra subito il passo successivo
  await page.getByRole("button", { name: "Conferma l'ordine" }).click();
  await page.getByRole("button", { name: "Invia al deposito" }).click();
  await page.getByLabel("Numero DDT").fill(numeroDdt);
  await page.getByLabel("Data DDT").fill(new Date().toISOString().slice(0, 10));
  await page.getByLabel("Corriere").fill("BRT");
  await page.getByLabel("Tracking").fill("TRK123456");
  if (pdf) await page.getByLabel("PDF del DDT (facoltativo)").setInputFiles(pdf);
  await page.getByRole("button", { name: "Registra il DDT e segna spedito" }).click();
  await expect(page.getByRole("heading", { name: "Spedizione" })).toBeVisible();
}

test("confermo un ordine, parte l'email al deposito, registro il DDT e la farmacia lo vede", async ({ browser }, info) => {
  const ordine = await prenota(browser, 3, "Sagè Pharma");
  const page = await adminSu(browser);
  mkdirSync(info.outputDir, { recursive: true });
  const pdf = join(info.outputDir, "ddt.pdf");
  writeFileSync(pdf, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  await confermaInviaDdt(page, ordine.id, `D${Date.now().toString().slice(-6)}`, pdf);

  // Email al deposito CIENNE (in locale arriva nella casella di prova) con PDF + Excel
  const { data: sede } = await db.from("sedi").select("email").eq("predefinito", true).single();
  const html = await attendiEmail(sede!.email, `Richiesta di evasione ordine ${ordine.numero}`);
  expect(html).toContain(ordine.numero);
  const ricerca = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`subject:"${ordine.numero}" to:"${sede!.email}"`)}`)).json();
  expect(ricerca.messages[0].Attachments).toBe(2);

  // La farmacia vede DDT, corriere e tracking e scarica il PDF
  await attendiEmail(farmacia.email, `Ordine ${ordine.numero} spedito`);
  await ordine.page.goto(`/farmacia/ordini/${ordine.id}`);
  await expect(ordine.page.getByText(/DDT.*n\. D\d+ del/).first()).toBeVisible();
  await expect(ordine.page.getByText("TRK123456")).toBeVisible();
  const download = await ordine.page.request.get(`/api/ordini/${ordine.id}/ddt`);
  expect(download.headers()["content-type"]).toBe("application/pdf");

  const { data: stato } = await db.from("ordini").select("stato").eq("id", ordine.id).single();
  expect(stato?.stato).toBe("spedito");
});

test("l'elenco dei DDT da fatturare si separa tra Sagè Pharma e Bioeleva", async ({ browser }) => {
  const sage = await prenota(browser, 2, "Sagè Pharma");
  const bioeleva = await prenota(browser, 2, "Bioeleva");
  const page = await adminSu(browser);
  const ddtSage = `S${Date.now().toString().slice(-6)}`;
  const ddtBio = `B${Date.now().toString().slice(-6)}`;
  await confermaInviaDdt(page, sage.id, ddtSage);
  await confermaInviaDdt(page, bioeleva.id, ddtBio);

  const { data: societa } = await db.from("societa").select("id, codice");
  const id = (c: string) => societa!.find((s) => s.codice === c)!.id;

  await page.goto(`/admin/fatturazione?societa=${id("sage")}&stato=da_fatturare`);
  await expect(page.getByText(`n. ${ddtSage}`)).toBeVisible();
  await expect(page.getByText(`n. ${ddtBio}`)).toHaveCount(0);

  await page.goto(`/admin/fatturazione?societa=${id("bioeleva")}&stato=da_fatturare`);
  await expect(page.getByText(`n. ${ddtBio}`)).toBeVisible();
  await expect(page.getByText(`n. ${ddtSage}`)).toHaveCount(0);

  // Segno fatturato il DDT Bioeleva: sparisce da "da fatturare"
  await page.getByLabel(`Seleziona DDT ${ddtBio}`).check();
  await page.getByRole("button", { name: "Segna selezionati come fatturati" }).click();
  await expect(page.getByText(`n. ${ddtBio}`)).toHaveCount(0);

  const excel = await page.request.get(`/api/admin/fatturazione/export?societa=${id("sage")}&stato=tutti`);
  expect(excel.headers()["content-type"]).toContain("spreadsheetml");
});

test("modifica prima dell'invio al deposito (quantità e società) e rifiuto con messaggio", async ({ browser }) => {
  const ordine = await prenota(browser, 4, "Sagè Pharma");
  const page = await adminSu(browser);
  await page.goto(`/admin/ordini/${ordine.id}`);
  await page.getByRole("button", { name: "Modifica (quantità, società, pagamento)" }).click();
  await page.getByLabel(`Quantità Prodotto di prova ${prodotto.codice}`).fill("2");
  await page.getByRole("combobox", { name: "Fattura e consegna" }).selectOption({ label: "Bioeleva" });
  await page.getByLabel("Messaggio per la farmacia").fill("Disponibili solo 2 pezzi per ora");
  await page.getByRole("button", { name: "Salva e conferma con modifiche" }).click();
  await expect(page.getByText("Ordine modificato e confermato")).toBeVisible();

  const { data: o } = await db.from("ordini").select("stato, totale_cent, snapshot_societa, righe:righe_ordine(quantita)").eq("id", ordine.id).single();
  expect(o?.stato).toBe("modificato");
  expect((o?.snapshot_societa as { codice: string }).codice).toBe("bioeleva");
  expect((o?.righe as { quantita: number }[])[0].quantita).toBe(2);
  const email = await attendiEmail(farmacia.email, `Ordine ${ordine.numero} confermato con modifiche`);
  expect(email).toContain("BIOELEVA S.r.l.");
  expect(email).toContain("Disponibili solo 2 pezzi per ora");

  await page.reload();
  await page.getByRole("button", { name: "Rifiuta l'ordine" }).click();
  // Il motivo è obbligatorio: senza, il modulo non parte
  await page.getByRole("button", { name: "Rifiuta l'ordine" }).click();
  await expect(page.getByLabel("Motivo (lo riceve la farmacia)")).toBeVisible();
  await page.getByLabel("Motivo (lo riceve la farmacia)").fill("Prova di rifiuto");
  await page.getByRole("button", { name: "Rifiuta l'ordine" }).click();
  await expect(page.locator("header").getByText("Rifiutato")).toBeVisible();
  const rifiuto = await attendiEmail(farmacia.email, `Ordine ${ordine.numero} non accettato`);
  expect(rifiuto).toContain("Prova di rifiuto");
});
