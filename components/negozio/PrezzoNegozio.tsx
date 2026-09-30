import { formattaEuro } from "@/lib/formato";
import type { PrezzoPrivato } from "@/lib/pricing";

// Prezzo per i privati: prezzo pieno barrato e sconto del mese quando c'è, prezzo finale IVA inclusa in evidenza.
export function PrezzoNegozio({ prezzo, grande = false }: { prezzo: PrezzoPrivato; grande?: boolean }) {
  const scontato = prezzo.scontoPercentuale > 0;
  return (
    <div>
      {scontato && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="line-through text-muted" aria-label={`Prezzo pieno ${formattaEuro(prezzo.pienoCent)}`}>{formattaEuro(prezzo.pienoCent)}</span>
          <span className="pill pill-bad">−{prezzo.scontoPercentuale.toLocaleString("it-IT")}% questo mese</span>
        </p>
      )}
      <p className={`${grande ? "text-3xl" : "text-2xl"} font-bold text-magistra-blu`}>{formattaEuro(prezzo.ivatoCent)}</p>
      <p className="text-xs text-muted">IVA inclusa</p>
    </div>
  );
}

export function Disponibilita({ disponibile }: { disponibile: boolean }) {
  return disponibile ? <span className="pill pill-ok">Disponibile</span> : <span className="pill pill-off">Non disponibile</span>;
}
