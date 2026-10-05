import { expect, test } from "@playwright/test";
import { extractText, getDocumentProxy } from "unpdf";
import { accedi, attendiEmail, compilaInvio, creaAdminTemporaneo, creaFarmaciaAttiva, creaProdottoDiTest, db } from "./supporto";

// Promozioni con volantino e "omaggio extra" non a magazzino (es. espositore ogni 24 pezzi), 05/10/2026.

let admin: Awaited<ReturnType<typeof creaAdminTemporaneo>>;
let farmacia: Awaited<ReturnType<typeof creaFarmaciaAttiva>>;
let prodotto: Awaited<ReturnType<typeof creaProdottoDiTest>>;
let promozioneId: string | null = null;

// PNG 1×1 valido, come volantino di prova
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test.beforeAll(async () => {
  admin = await creaAdminTemporaneo();
  farmacia = await creaFarmaciaAttiva("Farmacia Volantino");
  prodotto = await creaProdottoDiTest(100);
});
test.afterAll(async () => {
  if (promozioneId) {
    const { data } = await db.from("promozioni").select("immagine_path").eq("id", promozioneId).single();
    if (data?.immagine_path) await db.storage.from("promozioni").remove([data.immagine_path]);
    await db.from("promozioni").delete().eq("id", promozioneId);
  }
  await farmacia.elimina();
  await prodotto.elimina();
  await admin.elimina();
});

test("promozione con volantino ed espositore in omaggio: la farmacia la vede, ordina 24 pezzi e l'espositore arriva in ordine, email e PDF", async ({ browser }) => {
  // L'admin crea la promozione
  const pa = await (await browser.newContext()).newPage();
  await accedi(pa, admin.email, admin.password);
  await expect(pa).toHaveURL("/admin");
  await pa.goto("/admin/promozioni/nuova");
  await pa.getByLabel("Nome").fill("Prova espositore");
  await pa.getByLabel("Sconto %", { exact: true }).first().check();
  await pa.locator("input[name=sconto_percentuale]").fill("42");
  await pa.getByLabel("Prodotto", { exact: true }).selectOption(prodotto.codice);
  await pa.getByLabel("Cosa si regala").fill("espositore da banco di prova");
  await pa.locator("input[name=omaggio_extra_ogni]").fill("24");
  await pa.locator("input[name=omaggio_extra_quantita]").fill("1");
  await pa.getByLabel("Carica un'immagine").setInputFiles({ name: "volantino.png", mimeType: "image/png", buffer: PNG });
  await pa.getByRole("button", { name: "Crea la promozione" }).click();
  await expect(pa.getByText("Promozione creata")).toBeVisible();
  promozioneId = pa.url().match(/promozioni\/([^?]+)/)![1];
  await expect(pa.getByRole("img", { name: "Volantino attuale" })).toBeVisible();
  const { data: promo } = await db.from("promozioni").select("immagine_path, omaggio_extra_ogni").eq("id", promozioneId).single();
  expect(promo!.immagine_path).toMatch(/\.png$/);
  expect(promo!.omaggio_extra_ogni).toBe(24);

  // La farmacia vede il volantino e la promozione
  const page = await (await browser.newContext()).newPage();
  await accedi(page, farmacia.email, farmacia.password);
  await expect(page).toHaveURL("/farmacia");
  await expect(page.getByRole("heading", { name: "Offerte in corso" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Volantino dell'offerta Prova espositore" })).toBeVisible();
  await page.getByRole("img", { name: "Volantino dell'offerta Prova espositore" }).click();
  await expect(page).toHaveURL(`/farmacia/catalogo/${prodotto.codice}`);
  await expect(page.getByText("1 espositore da banco di prova in omaggio ogni 24 pezzi")).toBeVisible();
  // 20,00 € con sconto 42% → 11,60 € IVA incl. → 10,55 € IVA esclusa
  await expect(page.getByRole("cell", { name: "10,55 €" }).first()).toBeVisible();

  // 23 pezzi: nessun espositore; 24 pezzi: uno
  await db.from("carrello_righe").insert({ farmacia_id: farmacia.farmaciaId, lotto_id: prodotto.lottoId, quantita: 23 });
  await page.goto("/farmacia/carrello");
  const rigaOmaggio = page.getByText(/^Omaggio\s*espositore da banco di prova$/);
  await expect(page.getByText("Promozione «Prova espositore»: 1 espositore")).toBeVisible();
  await expect(rigaOmaggio).toHaveCount(0);
  await db.from("carrello_righe").update({ quantita: 24 }).eq("farmacia_id", farmacia.farmaciaId);
  await page.reload();
  await expect(rigaOmaggio).toBeVisible();

  // Invio: l'espositore resta nell'ordine, nell'email e nel PDF
  await compilaInvio(page, { societa: "Sagè Pharma", pagamento: "Bonifico bancario anticipato", accetta: true });
  await page.getByRole("button", { name: "Invia la prenotazione" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Prenotazione inviata" })).toBeVisible();
  const id = page.url().match(/ordini\/([^?]+)/)![1];
  await expect(page.getByRole("cell", { name: /espositore da banco di prova/ })).toBeVisible();
  const { data: ordine } = await db.from("ordini").select("numero, omaggi_extra, imponibile_cent").eq("id", id).single();
  expect(ordine!.omaggi_extra).toEqual([{ promozione_id: promozioneId, nome: "Prova espositore", testo: "espositore da banco di prova", quantita: 1 }]);
  expect(ordine!.imponibile_cent).toBe(24 * 1055);

  const email = await attendiEmail(farmacia.email, `Prenotazione ${ordine!.numero} ricevuta`);
  expect(email).toContain("Omaggio: espositore da banco di prova");

  const r = await page.request.get(`/api/ordini/${id}/documento/pdf`);
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(await r.body())), { mergePages: true });
  expect(text).toContain("espositore da banco di prova");
});
