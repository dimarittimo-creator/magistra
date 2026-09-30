import { expect, test, type Page } from "@playwright/test";
import { accedi, attendiEmail, creaAdminTemporaneo, creaProdottoDiTest, db, linkDaEmail, password, suffisso } from "./supporto";

// Fase 5 – area Privati (docs/FASI.md)

let admin: Awaited<ReturnType<typeof creaAdminTemporaneo>>;
let prodotto: Awaited<ReturnType<typeof creaProdottoDiTest>>;
let spesePrima: { importo_cent: number | null; soglia_gratuita_cent: number | null } | null = null;
const clienti: string[] = [];
const oggi = new Date().toISOString().slice(0, 10);
const primo = `${oggi.slice(0, 7)}-01`;
const ultimo = new Date(Date.UTC(Number(oggi.slice(0, 4)), Number(oggi.slice(5, 7)), 0)).toISOString().slice(0, 10);

test.beforeAll(async () => {
  admin = await creaAdminTemporaneo();
  prodotto = await creaProdottoDiTest(30);
  const { data } = await db.from("spese_spedizione").select("importo_cent, soglia_gratuita_cent").eq("canale", "privati").single();
  spesePrima = data;
});
test.afterAll(async () => {
  for (const email of clienti) {
    const { data: p } = await db.from("profili_utente").select("id, privato_id").eq("email", email).maybeSingle();
    if (!p) continue;
    await db.from("ordini").delete().eq("privato_id", p.privato_id);
    await db.auth.admin.deleteUser(p.id);
    await db.from("privati").delete().eq("id", p.privato_id);
  }
  await db.from("sconti_privati").delete().eq("prodotto_codice", prodotto.codice);
  await db.from("spese_spedizione").update(spesePrima ?? { importo_cent: null, soglia_gratuita_cent: null }).eq("canale", "privati");
  await db.from("impostazioni").update({ area_privati_attiva: false }).eq("id", true);
  await prodotto.elimina();
  await admin.elimina();
});

async function registraCliente(page: Page, prossima: string) {
  const email = `e2e-privato-${suffisso()}@magistra.test`;
  const pwd = password();
  clienti.push(email);
  await page.goto(`/registrazione/privato?prossima=${encodeURIComponent(prossima)}`);
  await page.getByRole("textbox", { name: "Nome", exact: true }).fill("Mario");
  await page.getByLabel("Cognome").fill("Rossi");
  await page.getByLabel("Codice fiscale").fill("RSSMRA85T10A562S");
  await page.getByLabel("Telefono").fill("333 1234567");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByLabel("Via e numero civico").fill("Via Chiaia 10");
  await page.getByLabel("CAP").fill("80121");
  await page.getByLabel("Città").fill("Napoli");
  await page.getByLabel("Provincia").fill("NA");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(pwd);
  await page.getByLabel("Ripeti la password").fill(pwd);
  await page.getByLabel("Ho letto").check();
  await page.getByLabel("Accetto le").check();
  await page.getByRole("button", { name: "Crea il mio account" }).click();
  await expect(page).toHaveURL(/registrazione\/inviata\?tipo=privato/);
  const html = await attendiEmail(email, "Conferma il tuo indirizzo email");
  await page.goto(linkDaEmail(html, "/auth/conferma"));
  await expect(page).toHaveURL("/negozio");
  return { email, pwd };
}

test("un privato si registra, vede lo sconto del mese e ordina con la spedizione calcolata; a fine periodo lo sconto scade", async ({ page, browser }) => {
  await db.from("spese_spedizione").update({ importo_cent: 690, soglia_gratuita_cent: null, iva: 22, attiva: true }).eq("canale", "privati");

  // L'admin crea lo sconto del mese sul prodotto (con anteprima del prezzo finale)
  const pa = await (await browser.newContext()).newPage();
  await accedi(pa, admin.email, admin.password);
  await expect(pa).toHaveURL("/admin");
  await pa.goto("/admin/sconti-privati");
  await pa.getByLabel("Su cosa").selectOption("prodotto");
  await pa.getByLabel("Prodotto", { exact: true }).selectOption(prodotto.codice);
  await pa.getByLabel("Sconto %").fill("20");
  await expect(pa.getByText("Anteprima: 1 prodotti cambiano prezzo")).toBeVisible();
  await expect(pa.getByRole("cell", { name: "16,00 €" })).toBeVisible();
  await pa.getByRole("button", { name: "Salva lo sconto" }).click();
  await expect(pa.getByText("Sconto salvato")).toBeVisible();

  // Il privato vede prezzo pieno barrato, sconto del mese e prezzo finale, ma non lotti né giacenze
  await page.goto(`/negozio/${prodotto.codice}`);
  await expect(page.getByText("−20% questo mese")).toBeVisible();
  await expect(page.getByText("16,00 €")).toBeVisible();
  await expect(page.getByText(prodotto.codiceLotto)).toHaveCount(0);
  await page.getByRole("link", { name: "Accedi per ordinare" }).click();
  await page.getByRole("link", { name: "Crea il tuo account" }).first().click();
  await registraCliente(page, `/negozio/${prodotto.codice}`);

  await page.goto(`/negozio/${prodotto.codice}`);
  await page.getByLabel("Quantità").selectOption("2");
  await page.getByRole("button", { name: "Aggiungi al carrello" }).click();
  await expect(page.getByText("Aggiunto al carrello")).toBeVisible();
  await page.goto("/negozio/carrello");
  // 2 × 16,00 = 32,00 + spedizione 6,90 = 38,90
  await expect(page.getByText("6,90 €")).toBeVisible();
  await expect(page.getByText("38,90 €")).toBeVisible();
  await page.getByLabel("Come vuoi pagare?").selectOption({ label: "Contrassegno (pagamento alla consegna)" });
  await page.getByLabel("Ho letto e accetto").check();
  await page.getByRole("button", { name: "Conferma l'ordine" }).click();
  await expect(page.getByText("Grazie, ordine ricevuto!")).toBeVisible();

  const id = page.url().match(/ordini\/([^?]+)/)![1];
  const { data: o } = await db.from("ordini").select("numero, canale, spese_spedizione_cent, totale_cent, righe:righe_ordine(lotto_id, quantita, prezzo_farmacia_ivato_cent)").eq("id", id).single();
  expect(o).toMatchObject({ canale: "privati", spese_spedizione_cent: 690, totale_cent: 3890 });
  expect(o!.righe).toEqual([{ lotto_id: prodotto.lottoId, quantita: 2, prezzo_farmacia_ivato_cent: 1600 }]);
  const email = await attendiEmail(clienti[0], `Ordine ${o!.numero} ricevuto`);
  expect(email).toContain("38,90");

  // A cambio mese lo sconto scade da solo
  const scorsoMese = new Date(Date.UTC(Number(primo.slice(0, 4)), Number(primo.slice(5, 7)) - 2, 1)).toISOString().slice(0, 10);
  await db.from("sconti_privati").update({ inizio: scorsoMese, fine: new Date(Date.parse(primo) - 86400000).toISOString().slice(0, 10) }).eq("prodotto_codice", prodotto.codice);
  await page.goto(`/negozio/${prodotto.codice}`);
  await expect(page.getByText("questo mese")).toHaveCount(0);
  await expect(page.getByText("20,00 €")).toBeVisible();
});

test("con il bonifico l'ordine va al deposito solo dopo il pagamento ricevuto", async ({ page, browser }) => {
  await db.from("spese_spedizione").update({ importo_cent: 690, soglia_gratuita_cent: 5000, iva: 22, attiva: true }).eq("canale", "privati");
  await page.goto("/negozio");
  const cliente = await registraCliente(page, "/negozio");
  const { data: prof } = await db.from("profili_utente").select("privato_id").eq("email", cliente.email).single();
  await db.from("carrello_privati").insert({ privato_id: prof!.privato_id, prodotto_codice: prodotto.codice, quantita: 3 });
  await page.goto("/negozio/carrello");
  // 3 × 20,00 = 60,00 ≥ 50,00: spedizione gratuita
  await expect(page.getByText("gratuita")).toBeVisible();
  await page.getByLabel("Come vuoi pagare?").selectOption({ label: "Bonifico bancario anticipato" });
  await page.getByLabel("Ho letto e accetto").check();
  await page.getByRole("button", { name: "Conferma l'ordine" }).click();
  await expect(page.getByText(/Per completare l'ordine fai un bonifico di 60,00/)).toBeVisible();
  const id = page.url().match(/ordini\/([^?]+)/)![1];

  const pa = await (await browser.newContext()).newPage();
  await accedi(pa, admin.email, admin.password);
  await expect(pa).toHaveURL("/admin");
  await pa.goto(`/admin/ordini/${id}`);
  await pa.getByRole("button", { name: "Conferma l'ordine" }).click();
  await expect(pa.getByText("In attesa del bonifico del cliente")).toBeVisible();
  await expect(pa.getByRole("button", { name: "Invia al deposito" })).toHaveCount(0);
  await pa.getByRole("button", { name: "Segna pagamento ricevuto" }).click();
  await expect(pa.getByRole("button", { name: "Invia al deposito" })).toBeVisible();
});

test("l'admin non riesce ad attivare l'area Privati online senza spese di spedizione e condizioni definitive", async ({ page }) => {
  await db.from("spese_spedizione").update({ importo_cent: null }).eq("canale", "privati");
  await accedi(page, admin.email, admin.password);
  await expect(page).toHaveURL("/admin");
  await page.goto("/admin/area-privati");
  await expect(page.getByText("Per attivarla: Mancano le spese di spedizione per i privati")).toBeVisible();
  await page.getByRole("button", { name: "Attiva l'area Privati online" }).click();
  await expect(page.getByText("Non si può attivare: Mancano le spese di spedizione")).toBeVisible();

  // Con le spese impostate manca ancora il testo definitivo delle condizioni
  await page.getByLabel("Spese di spedizione (€, IVA inclusa)").fill("6,90");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page.getByText("Salvato.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Attiva l'area Privati online" }).click();
  await expect(page.getByText(/Non si può attivare: Mancano le condizioni di vendita per i privati validate/)).toBeVisible();

  // Anche direttamente sul database l'attivazione è rifiutata
  const { error } = await db.from("impostazioni").update({ area_privati_attiva: true }).eq("id", true);
  expect(error?.message).toContain("Area Privati non attivabile");
  const { data } = await db.from("impostazioni").select("area_privati_attiva").single();
  expect(data?.area_privati_attiva).toBe(false);
});
