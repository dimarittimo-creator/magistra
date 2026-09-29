import ExcelJS from "exceljs";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { extractText, getDocumentProxy } from "unpdf";
import { accedi, compilaInvio, creaAdminTemporaneo, creaFarmaciaAttiva, creaProdottoDiTest, db } from "./supporto";

// Fase 4 – documenti: i totali di PDF ed Excel coincidono al centesimo con il riepilogo;
// cambiando società cambiano intestazione e dati fiscali; DDT simulato con la dicitura obbligatoria.

let admin: Awaited<ReturnType<typeof creaAdminTemporaneo>>;
let farmacia: Awaited<ReturnType<typeof creaFarmaciaAttiva>>;
const prodotti: Awaited<ReturnType<typeof creaProdottoDiTest>>[] = [];

test.beforeAll(async () => {
  admin = await creaAdminTemporaneo();
  farmacia = await creaFarmaciaAttiva("Farmacia Documenti");
  prodotti.push(await creaProdottoDiTest(30));
  await new Promise((r) => setTimeout(r, 5)); // codici prodotto diversi
  prodotti.push(await creaProdottoDiTest(30));
  // Secondo prodotto con IVA al 22% e prezzo diverso, per avere due aliquote
  await db.from("prodotti").update({ prezzo_pubblico_cent: 3790, iva_override: 22 }).eq("codice", prodotti[1].codice);
});
test.afterAll(async () => {
  await farmacia.elimina();
  for (const p of prodotti) await p.elimina();
  await admin.elimina();
});

const euro = (cent: number) => (cent / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" }).replace(/\s/g, " ");
const normalizza = (t: string) => t.replace(/[\s  ]+/g, " ");

async function testoPdf(request: APIRequestContext, url: string) {
  const r = await request.get(url);
  expect(r.headers()["content-type"]).toBe("application/pdf");
  const pdf = await getDocumentProxy(new Uint8Array(await r.body()));
  const { text } = await extractText(pdf, { mergePages: true });
  return normalizza(text);
}

async function prenota(page: Page) {
  await db.from("carrello_righe").delete().eq("farmacia_id", farmacia.farmaciaId);
  await db.from("carrello_righe").insert([
    { farmacia_id: farmacia.farmaciaId, lotto_id: prodotti[0].lottoId, quantita: 7 },
    { farmacia_id: farmacia.farmaciaId, lotto_id: prodotti[1].lottoId, quantita: 3 },
  ]);
  await page.goto("/farmacia/carrello");
  await compilaInvio(page, { societa: "Sagè Pharma", pagamento: "Bonifico bancario anticipato", accetta: true });
  await page.getByRole("button", { name: "Invia la prenotazione" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Prenotazione inviata" })).toBeVisible();
  return page.url().match(/ordini\/([^?]+)/)![1];
}

test("PDF ed Excel dell'ordine: totali uguali al riepilogo, dati fiscali della società; il cambio di società cambia l'intestazione", async ({ page, browser }) => {
  await accedi(page, farmacia.email, farmacia.password);
  await expect(page).toHaveURL("/farmacia");
  const id = await prenota(page);
  const { data: o } = await db.from("ordini").select("numero, imponibile_cent, iva_cent, totale_cent, iva_dettaglio").eq("id", id).single();
  expect((o!.iva_dettaglio as unknown[]).length).toBe(2);

  // Il riepilogo a video mostra gli stessi totali salvati
  await expect(page.locator("tfoot").getByText(euro(o!.totale_cent), { exact: true })).toBeVisible();

  // PDF
  const pdf = await testoPdf(page.request, `/api/ordini/${id}/documento/pdf`);
  expect(pdf).toContain(`Riepilogo ordine ${o!.numero}`);
  expect(pdf).toContain("SAGE' PHARMA S.r.l.");
  expect(pdf).toContain("P.IVA 01698370994");
  expect(pdf).toContain(farmacia.ragioneSociale);
  expect(pdf).toContain(normalizza(euro(o!.imponibile_cent)));
  expect(pdf).toContain(normalizza(euro(o!.totale_cent)));
  expect(pdf).toContain("IBAN IBAN-RIMOSSO");
  expect(pdf).toContain("Ordine effettuato tramite Magistra");

  // Excel: righe e totali al centesimo
  const r = await page.request.get(`/api/ordini/${id}/documento/excel`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await r.body()) as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  const valori: Record<string, number> = {};
  let sommaRighe = 0;
  let inRighe = false;
  ws.eachRow((row) => {
    const a = String(row.getCell(1).value ?? "");
    if (a === "Prodotto") inRighe = true;
    else if (inRighe && typeof row.getCell(10).value === "number" && a) sommaRighe += Math.round((row.getCell(10).value as number) * 100);
    const etichetta = row.getCell(8).value;
    if (typeof etichetta === "string" && typeof row.getCell(10).value === "number") valori[etichetta] = Math.round((row.getCell(10).value as number) * 100);
  });
  expect(valori.Imponibile).toBe(o!.imponibile_cent);
  expect(valori.Totale).toBe(o!.totale_cent);
  expect(sommaRighe).toBe(o!.imponibile_cent);
  expect(Object.entries(valori).filter(([k]) => k.startsWith("IVA")).reduce((s, [, v]) => s + v, 0)).toBe(o!.iva_cent);

  // L'admin cambia la società: intestazione e dati fiscali diventano quelli di Bioeleva
  const pa = await (await browser.newContext()).newPage();
  await accedi(pa, admin.email, admin.password);
  await expect(pa).toHaveURL("/admin");
  await pa.goto(`/admin/ordini/${id}`);
  await pa.getByRole("button", { name: "Modifica (quantità, società, pagamento)" }).click();
  await pa.getByRole("combobox", { name: "Fattura e consegna" }).selectOption({ label: "Bioeleva" });
  await pa.getByRole("button", { name: "Salva e conferma con modifiche" }).click();
  await expect(pa.getByText("Ordine modificato e confermato")).toBeVisible();

  const pdfBio = await testoPdf(page.request, `/api/ordini/${id}/documento/pdf`);
  expect(pdfBio).toContain("BIOELEVA S.r.l.");
  expect(pdfBio).toContain("P.IVA 04363330277");
  expect(pdfBio).not.toContain("01698370994");
  expect(pdfBio).toContain("IBAN IBAN-RIMOSSO");
  expect(pdfBio).toContain(normalizza(euro(o!.totale_cent)));
});

test("DDT simulato: mittente la società, partenza dal deposito, dicitura obbligatoria e condizioni di vendita", async ({ page }) => {
  await accedi(page, farmacia.email, farmacia.password);
  await expect(page).toHaveURL("/farmacia");
  const id = await prenota(page);
  await expect(page.getByRole("link", { name: "DDT simulato" })).toBeVisible();
  const ddt = await testoPdf(page.request, `/api/ordini/${id}/documento/ddt-simulato`);
  expect(ddt).toContain("Documento non valido ai fini fiscali – prenotazione non vincolante");
  expect(ddt).toContain("MITTENTE SAGE' PHARMA S.r.l.");
  expect(ddt).toContain("Via Salvatore Piccolo, 211");
  expect(ddt).not.toContain("NEW CIENNE"); // i dati dell'operatore logistico non vanno ai clienti
  expect(ddt).toContain("Condizioni di vendita accettate");
  expect(ddt).toContain("In nessun caso sono previsti resi");

  // Un'altra farmacia non può scaricare i documenti di questo ordine
  const altra = await creaFarmaciaAttiva("Farmacia Estranea");
  try {
    const ctx = await page.context().browser()!.newContext();
    const p2 = await ctx.newPage();
    await accedi(p2, altra.email, altra.password);
    await expect(p2).toHaveURL("/farmacia");
    const r = await p2.request.get(`/api/ordini/${id}/documento/pdf`);
    expect(r.status()).toBe(403);
  } finally {
    await altra.elimina();
  }
});
