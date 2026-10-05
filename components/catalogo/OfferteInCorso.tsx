import Link from "next/link";
import type { OffertaConVolantino } from "@/lib/catalogo";
import { formattaData } from "@/lib/formato";
import { urlVolantino } from "@/lib/promozioni";

// Volantini delle promozioni in corso per la farmacia (pagina iniziale e scheda prodotto).
export function OfferteInCorso({ offerte, titolo = "Offerte in corso", collegaProdotto = true }: { offerte: OffertaConVolantino[]; titolo?: string; collegaProdotto?: boolean }) {
  if (!offerte.length) return null;
  return (
    <section className="panel p-4 sm:p-6 mt-6" aria-labelledby="titolo-offerte">
      <h2 id="titolo-offerte" className="text-2xl text-magistra-blu mb-4">{titolo}</h2>
      <ul className="grid gap-6 sm:grid-cols-2">
        {offerte.map((o) => {
          const href = collegaProdotto && o.prodotti.length === 1 ? `/farmacia/catalogo/${o.prodotti[0]}` : "/farmacia/catalogo";
          return (
            <li key={o.id} className="space-y-2">
              <Link href={href} className="block rounded-lg overflow-hidden border border-line hover:border-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlVolantino(o.immagine_path)} alt={`Volantino dell'offerta ${o.nome}`} className="w-full h-auto" loading="lazy" />
              </Link>
              <p className="text-sm">
                <span className="font-semibold">{o.nome}</span>
                <span className="text-muted"> · fino al {formattaData(o.fine)}</span>
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
