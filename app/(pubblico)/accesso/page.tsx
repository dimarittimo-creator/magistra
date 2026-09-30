import Link from "next/link";
import { redirect } from "next/navigation";
import { paginaIniziale, utenteCorrente } from "@/lib/auth";
import { areaPrivatiAperta } from "@/lib/negozio";
import { FormAccesso } from "./FormAccesso";

export const metadata = { title: "Accesso" };

const MESSAGGI: Record<string, { ok: boolean; testo: string }> = {
  link: { ok: false, testo: "Il link non è valido o è scaduto. Accedi oppure richiedine uno nuovo." },
  password: { ok: true, testo: "Password aggiornata. Accedi con la nuova password." },
};

export default async function Accesso({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; prossima?: string; esito?: string }>;
}) {
  const { area, prossima, esito } = await searchParams;
  const utente = await utenteCorrente();
  if (utente) redirect(paginaIniziale(utente.profilo?.ruolo));

  const messaggio = esito ? MESSAGGI[esito] : undefined;

  if (area === "privati" || prossima?.startsWith("/negozio")) {
    if (!(await areaPrivatiAperta())) {
      return (
        <div className="mx-auto max-w-xl px-4 py-12">
          <div className="panel p-6 sm:p-8">
            <h1 className="text-3xl text-magistra-blu">
              Area Privati
              <span className="filetto" aria-hidden="true" />
            </h1>
            <p className="mt-5 text-muted">
              Il negozio per i clienti privati sarà disponibile a breve. Nel frattempo puoi rivolgerti alla tua farmacia di fiducia.
            </p>
            <Link href="/" className="btn btn-secondary mt-6">Torna alla home</Link>
          </div>
        </div>
      );
    }
    const dopo = prossima?.startsWith("/negozio") ? prossima : "/negozio";
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14 grid gap-6 md:grid-cols-[1.1fr_1fr] items-start">
        <section className="panel p-6 sm:p-8" aria-labelledby="titolo-accesso">
          <h1 id="titolo-accesso" className="text-3xl text-magistra-blu">
            Accedi al negozio
            <span className="filetto" aria-hidden="true" />
          </h1>
          {messaggio && (
            <p role="status" className={`avviso mt-5 ${messaggio.ok ? "avviso-ok" : "avviso-errore"}`}>{messaggio.testo}</p>
          )}
          <div className="mt-6">
            <FormAccesso prossima={dopo} />
          </div>
        </section>
        <section className="panel p-6 sm:p-8" aria-labelledby="titolo-nuovo">
          <h2 id="titolo-nuovo" className="text-2xl text-magistra-blu">
            Prima volta?
            <span className="filetto" aria-hidden="true" />
          </h2>
          <p className="mt-4 text-muted">Crea il tuo account in un minuto: ti serve per ordinare e seguire la spedizione.</p>
          <Link href={`/registrazione/privato?prossima=${encodeURIComponent(dopo)}`} className="btn btn-primary mt-6">Crea il tuo account</Link>
          <p className="mt-4 text-sm"><Link href="/negozio">Oppure continua a guardare il negozio</Link></p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14 grid gap-6 md:grid-cols-[1.1fr_1fr] items-start">
      <section className="panel p-6 sm:p-8" aria-labelledby="titolo-accesso">
        <h1 id="titolo-accesso" className="text-3xl text-magistra-blu">
          Accedi a Magistra
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted">Farmacie e amministrazione: entra con l&apos;email e la password del tuo account.</p>
        {messaggio && (
          <p role="status" className={`avviso mt-5 ${messaggio.ok ? "avviso-ok" : "avviso-errore"}`}>
            {messaggio.testo}
          </p>
        )}
        <div className="mt-6">
          <FormAccesso prossima={prossima} />
        </div>
      </section>

      <section className="panel p-6 sm:p-8" aria-labelledby="titolo-nuova">
        <h2 id="titolo-nuova" className="text-2xl text-magistra-blu">
          La tua farmacia non è ancora iscritta?
          <span className="filetto" aria-hidden="true" />
        </h2>
        <p className="mt-4 text-muted">
          Compila la richiesta di iscrizione. Dopo la verifica dei dati da parte della nostra amministrazione potrai
          consultare prezzi e disponibilità dei lotti e inviare prenotazioni d&apos;ordine.
        </p>
        <Link href="/registrazione" className="btn btn-primary mt-6">
          Richiedi l&apos;iscrizione
        </Link>
      </section>
    </div>
  );
}
