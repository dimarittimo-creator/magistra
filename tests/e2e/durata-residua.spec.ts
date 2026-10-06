import { expect, test } from "@playwright/test";
import { accedi, compilaInvio, creaFarmaciaAttiva, creaProdottoDiTest, db, suffisso } from "./supporto";

// Condizioni di vendita farmacie (06/10/2026), art. 7.1: lotti con durata residua inferiore a 8 mesi
// solo con accettazione espressa prima dell'invio.

let farmacia: Awaited<ReturnType<typeof creaFarmaciaAttiva>>;
let prodotto: Awaited<ReturnType<typeof creaProdottoDiTest>>;
let lottoCorto: string;

test.beforeAll(async () => {
  farmacia = await creaFarmaciaAttiva("Farmacia Scadenze");
  prodotto = await creaProdottoDiTest(30);
  const { data: deposito } = await db.from("sedi").select("id").eq("predefinito", true).single();
  const scadenza = new Date();
  scadenza.setMonth(scadenza.getMonth() + 5);
  const oggi = new Date().toISOString().slice(0, 10);
  const { data: lotto, error } = await db
    .from("lotti")
    .insert({ prodotto_codice: prodotto.codice, deposito_id: deposito!.id, codice_lotto: `CORTO-${suffisso()}`, scadenza: scadenza.toISOString().slice(0, 10), giacenza: 20, data_giacenza: oggi })
    .select("id")
    .single();
  if (error) throw error;
  lottoCorto = lotto.id;
  // la giacenza dichiarata deve coincidere con la somma dei lotti, altrimenti il prodotto è "difforme"
  await db.from("giacenze_prodotto").update({ totale_dichiarato: 50 }).eq("prodotto_codice", prodotto.codice);
});
test.afterAll(async () => {
  await farmacia.elimina();
  await db.from("carrello_righe").delete().eq("lotto_id", lottoCorto);
  await db.from("lotti").delete().eq("id", lottoCorto);
  await prodotto.elimina();
});

test("un lotto con meno di 8 mesi si ordina solo accettando espressamente la durata ridotta", async ({ page }) => {
  await accedi(page, farmacia.email, farmacia.password);
  await expect(page).toHaveURL("/farmacia");

  // Il lotto corto è segnalato nella scheda prodotto
  await page.goto(`/farmacia/catalogo/${prodotto.codice}`);
  await expect(page.getByText("sotto i 8 mesi").first()).toBeVisible();

  // Nel carrello: avviso sulla riga e casella obbligatoria
  await db.from("carrello_righe").insert({ farmacia_id: farmacia.farmaciaId, lotto_id: lottoCorto, quantita: 2 });
  await page.goto("/farmacia/carrello");
  await expect(page.getByText("Durata residua inferiore a 8 mesi: da accettare prima dell'invio")).toBeVisible();
  await compilaInvio(page, { societa: "Sagè Pharma", pagamento: "Bonifico bancario anticipato", accetta: true });
  await page.getByRole("button", { name: "Invia la prenotazione" }).click();
  await expect(page.getByText("devi accettare la durata residua inferiore a 8 mesi")).toBeVisible();
  const { count } = await db.from("ordini").select("id", { count: "exact", head: true }).eq("farmacia_id", farmacia.farmaciaId);
  expect(count).toBe(0);

  // Con l'accettazione l'ordine parte e la registra
  await page.getByLabel("Accetto espressamente").check();
  if (!(await page.getByLabel("Ho letto e accetto").isChecked())) await page.getByLabel("Ho letto e accetto").check();
  await page.getByRole("button", { name: "Invia la prenotazione" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Prenotazione inviata" })).toBeVisible();
  await expect(page.getByText("ha accettato espressamente")).toBeVisible();
  const { data: ordine } = await db.from("ordini").select("durata_ridotta_accettata").eq("farmacia_id", farmacia.farmaciaId).single();
  expect(ordine!.durata_ridotta_accettata).toBe(true);
});

test("con soli lotti oltre gli 8 mesi non compare nessuna richiesta di accettazione", async ({ page }) => {
  await db.from("carrello_righe").delete().eq("farmacia_id", farmacia.farmaciaId);
  await db.from("carrello_righe").insert({ farmacia_id: farmacia.farmaciaId, lotto_id: prodotto.lottoId, quantita: 1 });
  await accedi(page, farmacia.email, farmacia.password);
  await expect(page).toHaveURL("/farmacia");
  await page.goto("/farmacia/carrello");
  await expect(page.getByRole("button", { name: "Invia la prenotazione" })).toBeVisible();
  await expect(page.getByLabel("Accetto espressamente")).toHaveCount(0);
});
