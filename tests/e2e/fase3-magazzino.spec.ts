import { expect, test } from "@playwright/test";
import { accedi, creaAdminTemporaneo, creaFarmaciaAttiva, creaProdottoDiTest, db } from "./supporto";

// Fase 3 – magazzino, sconti e prezzi (docs/FASI.md)

let admin: Awaited<ReturnType<typeof creaAdminTemporaneo>>;
test.beforeAll(async () => {
  admin = await creaAdminTemporaneo();
});
test.afterAll(async () => {
  await admin.elimina();
});

test("importo la giacenza di esempio con anteprima e vedo ELIVID mancante temporaneamente", async ({ page }) => {
  await accedi(page, admin.email, admin.password);
  await expect(page).toHaveURL("/admin");
  await page.goto("/admin/magazzino");
  await page.getByLabel("Tipo di file").selectOption("deposito_crystal");
  await page.getByLabel("File", { exact: true }).setInputFiles("dati/giacenza_esempio_21-09-2026.xls");
  await expect(page.getByLabel("Data della giacenza")).toHaveValue("2026-09-21");
  await page.getByRole("button", { name: "Carica e mostra l'anteprima" }).click();

  await expect(page).toHaveURL(/\/admin\/magazzino\/import\/.+/);
  await expect(page.getByText("1 prodotti con difformità")).toBeVisible();
  await page.getByText("1 prodotti con difformità").locator("..").getByText("Mostra l'elenco").click();
  await expect(page.getByText(/ELIVID 60CPR: lotti 2\.?317, totale dichiarato 2\.?314/)).toBeVisible();
  await expect(page.getByText("2 lotti senza data di scadenza")).toBeVisible();

  await page.getByRole("button", { name: "Applica l'import" }).click();
  await expect(page.getByText(/^Applicato il/)).toBeVisible({ timeout: 30_000 });

  await page.goto("/admin/prodotti?q=ELIVID");
  await expect(page.getByRole("row", { name: /ELIVID/ }).getByText("Mancante temporaneamente")).toBeVisible();
});

test("un file sbagliato non viene importato e l'anteprima si può annullare", async ({ page }) => {
  await accedi(page, admin.email, admin.password);
  await expect(page).toHaveURL("/admin");
  await page.goto("/admin/magazzino");
  await page.getByLabel("Tipo di file").selectOption("deposito_crystal");
  await page.getByLabel("File", { exact: true }).setInputFiles("dati/listino_esempio.xlsx");
  await page.getByRole("button", { name: "Carica e mostra l'anteprima" }).click();
  await expect(page.getByText(/non ho trovato righe di giacenza/)).toBeVisible();

  await page.getByLabel("Tipo di file").selectOption("listino");
  await page.getByLabel("File", { exact: true }).setInputFiles("dati/listino_esempio.xlsx");
  await page.getByRole("button", { name: "Carica e mostra l'anteprima" }).click();
  await expect(page).toHaveURL(/\/admin\/magazzino\/import\/.+/);
  await page.getByRole("button", { name: "Annulla" }).click();
  await expect(page).toHaveURL("/admin/magazzino");
  await expect(page.getByRole("row", { name: /listino_esempio\.xlsx.*Annullato/ }).first()).toBeVisible();
});

test("lo sconto sul singolo lotto cambia subito il prezzo che vede la farmacia", async ({ page, browser }) => {
  const prodotto = await creaProdottoDiTest(10);
  const farmacia = await creaFarmaciaAttiva("Farmacia Sconti");
  try {
    await accedi(page, admin.email, admin.password);
    await expect(page).toHaveURL("/admin");
    await page.goto("/admin/sconti");
    await page.getByLabel("Cerca prodotto, codice o lotto").fill(prodotto.codice);
    await page.getByLabel(`Sconto del lotto ${prodotto.codiceLotto}`).fill("50");
    // 20,00 € con 50% → 10,00 € IVA incl. → 9,09 € IVA escl.
    await expect(page.getByRole("cell", { name: "9,09 €" })).toBeVisible();
    await expect(page.getByText(/Modifiche non salvate: cambiano 1 lotti/)).toBeVisible();
    await page.getByRole("button", { name: "Salva modifiche" }).click();
    await expect(page.getByText("Modifiche salvate")).toBeVisible();

    const pf = await (await browser.newContext()).newPage();
    await accedi(pf, farmacia.email, farmacia.password);
    await expect(pf).toHaveURL("/farmacia");
    await pf.goto(`/farmacia/catalogo/${prodotto.codice}`);
    await expect(pf.getByRole("cell", { name: "9,09 €" })).toBeVisible();
    await expect(pf.getByText("−50%").first()).toBeVisible();
  } finally {
    await farmacia.elimina();
    await prodotto.elimina();
  }
});

test("una fascia senza 0 mesi non si può salvare", async ({ page }) => {
  await accedi(page, admin.email, admin.password);
  await expect(page).toHaveURL("/admin");
  await page.goto("/admin/sconti");
  await page.getByLabel("Mesi minimi della fascia 3").fill("2");
  await expect(page.getByText("Serve una fascia da 0 mesi")).toBeVisible();
  await expect(page.getByRole("button", { name: "Salva modifiche" })).toBeDisabled();
  const { data } = await db.from("fasce_sconto").select("mesi_minimi");
  expect(data?.map((f) => f.mesi_minimi).sort()).toEqual([0, 6, 8]);
});
