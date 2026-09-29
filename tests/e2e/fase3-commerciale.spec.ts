import { expect, test, type Browser } from "@playwright/test";
import { accedi, compilaInvio, creaAdminTemporaneo, creaFarmaciaAttiva, creaProdottoDiTest, db, suffisso } from "./supporto";

// Fase 3 – listini di gruppo, promozioni, limitazioni dei pagamenti, pagine di amministrazione

let admin: Awaited<ReturnType<typeof creaAdminTemporaneo>>;
let farmacia: Awaited<ReturnType<typeof creaFarmaciaAttiva>>;
let prodotto: Awaited<ReturnType<typeof creaProdottoDiTest>>;
let gruppoId: string;

test.beforeAll(async () => {
  admin = await creaAdminTemporaneo();
  farmacia = await creaFarmaciaAttiva("Farmacia Gruppo");
  prodotto = await creaProdottoDiTest(40);
  const { data } = await db.from("gruppi").insert({ nome: `E2E gruppo ${suffisso()}` }).select("id").single();
  gruppoId = data!.id;
  await db.from("farmacie").update({ gruppo_id: gruppoId }).eq("id", farmacia.farmaciaId);
});
test.afterAll(async () => {
  await db.from("promozioni").delete().eq("prodotto_codice", prodotto.codice);
  await db.from("modalita_pagamento_limiti").delete().eq("gruppo_id", gruppoId);
  await farmacia.elimina();
  await prodotto.elimina();
  await db.from("gruppi").update({ attivo: false }).eq("id", gruppoId);
  await admin.elimina();
});

async function pagina(browser: Browser, email: string, password: string, attesa: string) {
  const page = await (await browser.newContext()).newPage();
  await accedi(page, email, password);
  await expect(page).toHaveURL(attesa);
  return page;
}

test("il listino dedicato al gruppo cambia il prezzo che vede la farmacia del gruppo", async ({ browser }) => {
  const pa = await pagina(browser, admin.email, admin.password, "/admin");
  await pa.goto(`/admin/gruppi/${gruppoId}`);
  await pa.getByPlaceholder("Cerca prodotto").fill(prodotto.codice);
  await pa.getByLabel(`Sconto riservato di Prodotto di prova ${prodotto.codice}`).fill("50");
  await pa.getByRole("button", { name: "Salva il listino" }).click();
  await expect(pa.getByText("Listino del gruppo salvato")).toBeVisible();

  const pf = await pagina(browser, farmacia.email, farmacia.password, "/farmacia");
  await pf.goto(`/farmacia/catalogo/${prodotto.codice}`);
  // 20,00 € con sconto riservato 50% → 9,09 € IVA esclusa (meglio della fascia 38%)
  await expect(pf.getByRole("cell", { name: "9,09 €" })).toBeVisible();
  await expect(pf.getByText("riservato").first()).toBeVisible();
  await db.from("listini_gruppo").delete().eq("gruppo_id", gruppoId);
});

test("promozione 10+2: gli omaggi compaiono nel carrello, finiscono nell'ordine e impegnano giacenza", async ({ browser }) => {
  const pa = await pagina(browser, admin.email, admin.password, "/admin");
  await pa.goto("/admin/promozioni/nuova");
  await pa.getByLabel("Nome").fill("Promo E2E 10+2");
  await pa.getByLabel("Sconto merce (es. 10+2)").check();
  await pa.getByLabel("Ogni (pezzi acquistati)").fill("10");
  await pa.getByLabel("Pezzi in omaggio").fill("2");
  await pa.getByLabel("Prodotto", { exact: true }).selectOption(prodotto.codice);
  await pa.getByRole("button", { name: "Crea la promozione" }).click();
  await expect(pa.getByText("Promozione creata")).toBeVisible();
  await pa.goto("/admin/promozioni");
  await expect(pa.getByRole("row", { name: /Promo E2E 10\+2.*Attiva/ })).toBeVisible();

  await db.from("carrello_righe").insert({ farmacia_id: farmacia.farmaciaId, lotto_id: prodotto.lottoId, quantita: 10 });
  const pf = await pagina(browser, farmacia.email, farmacia.password, "/farmacia");
  await pf.goto(`/farmacia/catalogo/${prodotto.codice}`);
  await expect(pf.getByText("10+2: ogni 10 pezzi, 2 in omaggio")).toBeVisible();
  await pf.goto("/farmacia/carrello");
  await expect(pf.getByText("+ 2 pezzi in omaggio (sconto merce)")).toBeVisible();
  await compilaInvio(pf, { pagamento: "RIBA 30 giorni", accetta: true });
  await pf.getByRole("button", { name: "Invia la prenotazione" }).click();
  await expect(pf.getByRole("status").filter({ hasText: "Prenotazione inviata" })).toBeVisible();

  const { data: righe } = await db.from("righe_ordine").select("quantita, quantita_omaggio, imponibile_cent").eq("lotto_id", prodotto.lottoId);
  expect(righe).toEqual([{ quantita: 10, quantita_omaggio: 2, imponibile_cent: 1127 * 10 }]);
  const { data: disp } = await db.rpc("disponibilita_lotti", { p_prodotto: prodotto.codice });
  expect((disp as { disponibile: number }[])[0].disponibile).toBe(40 - 12);
});

test("una modalità di pagamento limitata a un altro gruppo non compare nel carrello", async ({ browser }) => {
  const { data: altro } = await db.from("gruppi").insert({ nome: `E2E altro ${suffisso()}` }).select("id").single();
  const { data: riba90 } = await db.from("modalita_pagamento").select("id").eq("codice", "riba_90").single();
  await db.from("modalita_pagamento_limiti").insert({ modalita_id: riba90!.id, gruppo_id: altro!.id });
  try {
    await db.from("carrello_righe").delete().eq("farmacia_id", farmacia.farmaciaId);
    await db.from("carrello_righe").insert({ farmacia_id: farmacia.farmaciaId, lotto_id: prodotto.lottoId, quantita: 1 });
    const pf = await pagina(browser, farmacia.email, farmacia.password, "/farmacia");
    await pf.goto("/farmacia/carrello");
    const opzioni = await pf.getByLabel("Modalità di pagamento").locator("option").allTextContents();
    expect(opzioni).toContain("RIBA 60 giorni");
    expect(opzioni).not.toContain("RIBA 90 giorni");

    // Aggiunta la farmacia al gruppo abilitato, la modalità compare
    await db.from("modalita_pagamento_limiti").insert({ modalita_id: riba90!.id, gruppo_id: gruppoId });
    await pf.reload();
    expect(await pf.getByLabel("Modalità di pagamento").locator("option").allTextContents()).toContain("RIBA 90 giorni");
  } finally {
    await db.from("modalita_pagamento_limiti").delete().eq("modalita_id", riba90!.id);
    await db.from("gruppi").update({ attivo: false }).eq("id", altro!.id);
    await db.from("carrello_righe").delete().eq("farmacia_id", farmacia.farmaciaId);
  }
});

test("le pagine di amministrazione si aprono senza errori", async ({ browser }) => {
  const pa = await pagina(browser, admin.email, admin.password, "/admin");
  const errori: string[] = [];
  pa.on("pageerror", (e) => errori.push(e.message));
  for (const [url, titolo] of [
    ["/admin?giorni=90", /Buongiorno/],
    ["/admin/impostazioni", "Impostazioni"],
    ["/admin/documenti", "Condizioni e privacy"],
    ["/admin/pagamenti", "Modalità di pagamento"],
    ["/admin/fatturazione", "Fatturazione"],
    ["/admin/promozioni", "Promozioni"],
    ["/admin/sconti", "Sconti e prezzi farmacia"],
    ["/admin/magazzino", "Magazzino"],
    ["/admin/registro", "Registro operazioni"],
  ] as const) {
    const r = await pa.goto(url);
    expect(r?.status(), url).toBe(200);
    await expect(pa.getByRole("heading", { level: 1, name: titolo })).toBeVisible();
  }
  const excel = await pa.request.get("/api/admin/magazzino/export");
  expect(excel.headers()["content-type"]).toContain("spreadsheetml");
  expect(errori).toEqual([]);
});
