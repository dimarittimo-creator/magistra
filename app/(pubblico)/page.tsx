import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
      <section className="text-center">
        {/* Logo grande su fondo bianco anche in modalità scura */}
        <div className="inline-block bg-white rounded-2xl px-6 py-5 sm:px-10 sm:py-8">
          <Image
            src="/brand/logo-magistra.png"
            alt="Magistra – Semplicemente Magistrale"
            width={782}
            height={224}
            priority
            className="w-[min(82vw,520px)] h-auto"
          />
        </div>
        <p className="mt-6 text-lg text-muted max-w-2xl mx-auto">
          Il portale ordini di Sagè Pharma e Bioeleva per farmacie e clienti privati.
        </p>
      </section>

      <section className="mt-10 sm:mt-14 grid gap-5 sm:grid-cols-2" aria-label="Scegli la tua area">
        <SceltaArea
          titolo="Sei una farmacia?"
          testo="Consulta la merce del deposito, scegli lotti e condizioni e invia prenotazioni d'ordine non vincolanti."
          href="/accesso?area=farmacie"
          etichetta="Entra nell'area Farmacie"
        />
        <SceltaArea
          titolo="Sei un privato?"
          testo="Acquista gli integratori a prezzo al pubblico con gli sconti del mese e la consegna a casa."
          href="/accesso?area=privati"
          etichetta="Entra nell'area Privati"
        />
      </section>
    </div>
  );
}

function SceltaArea(props: { titolo: string; testo: string; href: string; etichetta: string }) {
  return (
    <div className="panel p-6 sm:p-8 flex flex-col">
      <h2 className="text-2xl text-magistra-blu">
        {props.titolo}
        <span className="filetto" aria-hidden="true" />
      </h2>
      <p className="mt-4 text-muted flex-1">{props.testo}</p>
      <Link href={props.href} className="btn btn-primary mt-6 self-start">
        {props.etichetta}
      </Link>
    </div>
  );
}
