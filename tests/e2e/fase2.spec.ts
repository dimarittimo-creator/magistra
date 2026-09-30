import { expect, test, type Page } from "@playwright/test";
import { accedi, attendiEmail, compilaInvio, creaFarmaciaAttiva, creaProdottoDiTest, db, ibanSocieta } from "./supporto";

// Criteri di accettazione della Fase 2 (docs/FASI.md).

const inviata = (page: Page) => page.getByRole("status").filter({ hasText: "Prenotazione inviata" });

let farmaciaA: Awaited<ReturnType<typeof creaFarmaciaAttiva>>;
let farmaciaB: Awaited<ReturnType<typeof creaFarmaciaAttiva>>;
const prodotti: Awaited<ReturnType<typeof creaProdottoDiTest>>[] = [];

test.beforeAll(async () => {
  farmaciaA = await creaFarmaciaAttiva("Farmacia Alfa");
  farmaciaB = await creaFarmaciaAttiva("Farmacia Beta");
});

test.afterAll(async () => {
  await farmaciaA.elimina();
  await farmaciaB.elimina();
  for (const p of prodotti) await p.elimina();
});

test("prenotazione con Bioeleva: riepilogo ed email riportano i dati Bioeleva e la merce resta impegnata", async ({ page }) => {
  const prodotto = await creaProdottoDiTest(10);
  prodotti.push(prodotto);

  await accedi(page, farmaciaA.email, farmaciaA.password);
  await expect(page).toHaveURL("/farmacia");
  await page.goto(`/farmacia/catalogo/${prodotto.codice}`);
  // 20,00 € al pubblico, scadenza fra un anno → fascia 1 (38%): 12,40 € IVA incl., 11,27 € IVA escl.
  await expect(page.getByRole("cell", { name: "11,27 €" })).toBeVisible();
  await page.getByLabel(`Quantità lotto ${prodotto.codiceLotto}`).filter({ visible: true }).fill("3");
  await page.getByRole("button", { name: "Aggiungi" }).filter({ visible: true }).click();
  await expect(page.getByText("Nel carrello: 3 pezzi")).toBeVisible();

  const ibanBio = await ibanSocieta("bioeleva");
  await page.goto("/farmacia/carrello");
  await compilaInvio(page, { societa: "Bioeleva", pagamento: "Bonifico bancario anticipato", accetta: true });
  await expect(page.getByText(new RegExp(`IBAN ${ibanBio} intestato a BIOELEVA`))).toBeVisible();
  await page.getByRole("button", { name: "Invia la prenotazione" }).click();

  await expect(page).toHaveURL(/\/farmacia\/ordini\/.+\?inviato=1/);
  await expect(inviata(page)).toBeVisible();
  const fattura = page.locator("section", { hasText: "Fattura e consegna" });
  await expect(fattura.getByText("BIOELEVA S.r.l.", { exact: true })).toBeVisible();
  await expect(fattura.getByText("P.IVA 04363330277")).toBeVisible();
  await expect(page.getByText(`IBAN ${ibanBio}`)).toBeVisible();
  const numero = (await page.getByRole("heading", { level: 1 }).innerText()).match(/P-\d{4}-\d{5}/)![0];

  const email = await attendiEmail(farmaciaA.email, `Prenotazione ${numero} ricevuta`);
  expect(email).toContain("BIOELEVA S.r.l.");
  expect(email).toContain("04363330277");
  expect(email).toContain(ibanBio);
  expect(email).toContain("Condizioni di vendita accettate");

  // La merce prenotata non è più disponibile per gli altri
  await page.goto(`/farmacia/catalogo/${prodotto.codice}`);
  await expect(page.getByRole("cell", { name: "7", exact: true })).toBeVisible();
});

test("senza modalità di pagamento o senza accettare le condizioni la prenotazione non parte", async ({ page }) => {
  const prodotto = await creaProdottoDiTest(5);
  prodotti.push(prodotto);
  await db.from("carrello_righe").insert({ farmacia_id: farmaciaB.farmaciaId, lotto_id: prodotto.lottoId, quantita: 1 });

  await accedi(page, farmaciaB.email, farmaciaB.password);
  await expect(page).toHaveURL("/farmacia");
  await page.goto("/farmacia/carrello");

  await compilaInvio(page, { accetta: true });
  await page.getByRole("button", { name: "Invia la prenotazione" }).click();
  await expect(page.getByText("Scegli la modalità di pagamento")).toBeVisible();

  await page.getByLabel("Ho letto e accetto").uncheck();
  await compilaInvio(page, { pagamento: "RIBA 30 giorni" });
  await page.getByRole("button", { name: "Invia la prenotazione" }).click();
  await expect(page.getByText("Per inviare la prenotazione devi accettare le condizioni di vendita")).toBeVisible();

  const { count } = await db.from("ordini").select("id", { count: "exact", head: true }).eq("farmacia_id", farmaciaB.farmaciaId);
  expect(count).toBe(0);
  await db.from("carrello_righe").delete().eq("farmacia_id", farmaciaB.farmaciaId);
});

test("due farmacie ordinano insieme l'ultima merce: ne passa una sola", async ({ browser }) => {
  const prodotto = await creaProdottoDiTest(4);
  prodotti.push(prodotto);
  for (const f of [farmaciaA, farmaciaB]) {
    await db.from("carrello_righe").delete().eq("farmacia_id", f.farmaciaId);
    await db.from("carrello_righe").insert({ farmacia_id: f.farmaciaId, lotto_id: prodotto.lottoId, quantita: 4 });
  }

  const pagine = await Promise.all(
    [farmaciaA, farmaciaB].map(async (f) => {
      const page = await (await browser.newContext()).newPage();
      await accedi(page, f.email, f.password);
      await expect(page).toHaveURL("/farmacia");
      await page.goto("/farmacia/carrello");
      await compilaInvio(page, { pagamento: "RIBA 60 giorni", accetta: true });
      return page;
    }),
  );

  // Invio contemporaneo: una passa, l'altra resta sul carrello con un avviso
  // (dal controllo del carrello o dal blocco dei lotti nel database, a seconda di chi arriva prima).
  await Promise.all(pagine.map((p) => p.getByRole("button", { name: "Invia la prenotazione" }).click()));
  const esito = async (p: Page) => ((await inviata(p).count()) ? "inviata" : (await p.getByRole("alert").count()) ? "fermata" : "in corso");
  await expect.poll(async () => (await Promise.all(pagine.map(esito))).sort().join(",")).toBe("fermata,inviata");

  const { data: righe } = await db.from("righe_ordine").select("quantita").eq("lotto_id", prodotto.lottoId);
  expect(righe?.map((r) => r.quantita)).toEqual([4]);
});

test("l'impegno nel database è transazionale: due invii nello stesso istante, uno solo va a buon fine", async () => {
  const prodotto = await creaProdottoDiTest(4);
  prodotti.push(prodotto);
  const [{ data: societa }, { data: pagamento }, { data: condizioni }, { data: deposito }] = await Promise.all([
    db.from("societa").select("id").eq("predefinita", true).single(),
    db.from("modalita_pagamento").select("id").eq("codice", "riba_30").single(),
    db.rpc("documento_legale_corrente", { p_tipo: "condizioni_farmacie" }),
    db.from("sedi").select("id").eq("predefinito", true).single(),
  ]);
  const riga = {
    lotto_id: prodotto.lottoId, prodotto_codice: prodotto.codice, prodotto_nome: "Prova", codice_lotto: prodotto.codiceLotto,
    scadenza: "2030-01-01", quantita: 4, prezzo_pubblico_cent: 2000, iva: 10, sconto_applicato: 38, origine_sconto: "fascia",
    prezzo_pubblico_netto_cent: 1818, prezzo_farmacia_ivato_cent: 1240, prezzo_farmacia_netto_cent: 1127, imponibile_cent: 4508,
  };
  const ordine = {
    societa_id: societa!.id, deposito_id: deposito!.id, modalita_pagamento_id: pagamento!.id, consegna_indicativa_giorni: 5,
    snapshot_cliente: {}, snapshot_societa: {}, snapshot_pagamento: {}, condizioni_documento_id: condizioni.id,
    condizioni_versione: condizioni.versione, imponibile_cent: 4508, sconti_cent: 0, iva_cent: 451, totale_cent: 4959,
  };
  const utenti = await Promise.all(
    [farmaciaA, farmaciaB].map(async (f) => (await db.from("profili_utente").select("id").eq("farmacia_id", f.farmaciaId).single()).data!.id),
  );
  const risultati = await Promise.all(utenti.map((u) => db.rpc("invia_ordine_farmacia", { p_utente: u, p_ordine: ordine, p_righe: [riga] })));
  expect(risultati.map((r) => r.data?.esito).sort()).toEqual(["merce_insufficiente", "ok"]);
});

test("una prenotazione non confermata scade, la merce torna disponibile e si può ripetere l'ordine", async ({ page, request }) => {
  const prodotto = await creaProdottoDiTest(6);
  prodotti.push(prodotto);
  await db.from("carrello_righe").delete().eq("farmacia_id", farmaciaA.farmaciaId);
  await db.from("carrello_righe").insert({ farmacia_id: farmaciaA.farmaciaId, lotto_id: prodotto.lottoId, quantita: 6 });

  await accedi(page, farmaciaA.email, farmaciaA.password);
  await expect(page).toHaveURL("/farmacia");
  await page.goto("/farmacia/carrello");
  await compilaInvio(page, { pagamento: "Contrassegno", accetta: true });
  await page.getByRole("button", { name: "Invia la prenotazione" }).click();
  await expect(inviata(page)).toBeVisible();
  const ordineId = page.url().match(/ordini\/([^?]+)/)![1];

  // Scadenza anticipata a ieri e giro del job
  await db.from("ordini").update({ scade_il: new Date(Date.now() - 86400000).toISOString() }).eq("id", ordineId);
  const risposta = await request.get("/api/cron/scadenze");
  expect(risposta.ok()).toBe(true);
  const { data: ordine } = await db.from("ordini").select("numero, stato").eq("id", ordineId).single();
  expect(ordine?.stato).toBe("scaduto");
  await attendiEmail(farmaciaA.email, `Prenotazione ${ordine!.numero} scaduta`);

  await page.goto(`/farmacia/ordini/${ordineId}`);
  await expect(page.locator("header").getByText("Scaduto")).toBeVisible();
  await page.getByRole("button", { name: "Ripeti ordine" }).click();
  await expect(page.getByText("1 prodotto aggiunto al carrello")).toBeVisible();
  const { data: carrello } = await db.from("carrello_righe").select("quantita").eq("farmacia_id", farmaciaA.farmaciaId).eq("lotto_id", prodotto.lottoId).single();
  expect(carrello?.quantita).toBe(6);
});

test("una farmacia in attesa di approvazione non vede catalogo né prezzi", async ({ page }) => {
  const nuova = await creaFarmaciaAttiva("Farmacia Gamma");
  await db.from("farmacie").update({ stato: "in_attesa" }).eq("id", nuova.farmaciaId);
  try {
    await accedi(page, nuova.email, nuova.password);
    await expect(page).toHaveURL("/farmacia");
    await expect(page.getByRole("link", { name: "Catalogo" })).toHaveCount(0);
    await page.goto("/farmacia/catalogo");
    await expect(page).toHaveURL("/farmacia");
    await page.goto("/farmacia/carrello");
    await expect(page).toHaveURL("/farmacia");
  } finally {
    await nuova.elimina();
  }
});
