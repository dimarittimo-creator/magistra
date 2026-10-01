import { expect, test } from "@playwright/test";
import { accedi, creaAdminTemporaneo, esci } from "./supporto";

// Fase 7 – amministratore: cambio password dall'area admin (serve anche senza email di recupero).

test("l'amministratore cambia la password e rientra con quella nuova", async ({ page }) => {
  const admin = await creaAdminTemporaneo();
  try {
    await accedi(page, admin.email, admin.password);
    await expect(page).toHaveURL("/admin");
    await page.getByRole("link", { name: "Il mio account" }).click();
    await page.getByRole("textbox", { name: "Nuova password", exact: true }).fill("corta");
    await page.getByRole("textbox", { name: "Ripeti la nuova password", exact: true }).fill("corta");
    await page.getByRole("button", { name: "Cambia password" }).click();
    await expect(page.getByText("Almeno 8 caratteri, con lettere e numeri")).toHaveCount(2); // aiuto + errore

    const nuova = `Nuova${Date.now()}`;
    await page.getByRole("textbox", { name: "Nuova password", exact: true }).fill(nuova);
    await page.getByRole("textbox", { name: "Ripeti la nuova password", exact: true }).fill(nuova);
    await page.getByRole("button", { name: "Cambia password" }).click();
    await expect(page.getByText("Password aggiornata")).toBeVisible();

    await esci(page);
    await accedi(page, admin.email, nuova);
    await expect(page).toHaveURL("/admin");
  } finally {
    await admin.elimina();
  }
});
