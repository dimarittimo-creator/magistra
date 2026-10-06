import { describe, expect, it } from "vitest";
import { sottoDurataGarantita } from "@/lib/availability";

// Condizioni di vendita farmacie (06/10/2026), art. 7.1: durata residua garantita di 8 mesi.
describe("durata residua garantita", () => {
  const oggi = "2026-10-06";
  it("sotto gli 8 mesi il lotto va accettato espressamente", () => {
    expect(sottoDurataGarantita("2027-06-05", oggi, 8)).toBe(true); // 7 mesi e 30 giorni
    expect(sottoDurataGarantita("2026-12-31", oggi, 8)).toBe(true);
  });
  it("da 8 mesi in su no (stesso calcolo di EDATE)", () => {
    expect(sottoDurataGarantita("2027-06-06", oggi, 8)).toBe(false);
    expect(sottoDurataGarantita("2028-11-30", oggi, 8)).toBe(false);
  });
  it("senza scadenza o con la regola spenta (0 mesi) non scatta", () => {
    expect(sottoDurataGarantita(null, oggi, 8)).toBe(false);
    expect(sottoDurataGarantita("2026-11-01", oggi, 0)).toBe(false);
  });
});
