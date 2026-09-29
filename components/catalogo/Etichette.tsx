import { ETICHETTE_STATO_PRODOTTO, type StatoProdotto } from "@/lib/availability";
import type { ScontoLotto } from "@/lib/pricing";

export function BadgeStatoProdotto({ stato }: { stato: StatoProdotto }) {
  const e = ETICHETTE_STATO_PRODOTTO[stato];
  return <span className={`pill ${e.classe}`}>{e.testo}</span>;
}

const COLORI_FASCIA = ["bg-fascia-1", "bg-fascia-2", "bg-fascia-3"];

/** Sconto del lotto con il colore della fascia (più intenso con lo sconto più alto), sempre con testo. */
export function BadgeSconto({ sconto }: { sconto: ScontoLotto }) {
  const percentuale = sconto.sconto.toLocaleString("it-IT", { maximumFractionDigits: 2 });
  const titolo =
    sconto.origine === "lotto"
      ? "Sconto dedicato a questo lotto"
      : sconto.origine === "promozione"
        ? "Promozione in corso"
        : `Fascia ${sconto.fascia} per scadenza`;
  const colore = sconto.origine === "fascia" ? (COLORI_FASCIA[(sconto.fascia ?? 1) - 1] ?? "bg-fascia-3") : "bg-brand";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={titolo}>
      <span className={`inline-block size-2.5 rounded-full ${colore}`} aria-hidden="true" />
      <span className="font-semibold">−{percentuale}%</span>
      {sconto.origine !== "fascia" && <span className="text-xs text-muted">{sconto.origine === "lotto" ? "lotto" : "promo"}</span>}
    </span>
  );
}
