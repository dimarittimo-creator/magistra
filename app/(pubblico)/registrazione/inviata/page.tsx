import Link from "next/link";

export const metadata = { title: "Registrazione inviata" };

export default async function IscrizioneInviata({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  const privato = tipo === "privato";
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="panel p-6 sm:p-10">
        <h1 className="text-3xl text-magistra-blu">
          {privato ? "Account creato" : "Richiesta inviata"}
          <span className="filetto" aria-hidden="true" />
        </h1>
        <ol className="mt-6 space-y-4 list-decimal pl-6">
          <li>
            <strong>Conferma la tua email.</strong> Ti abbiamo scritto all&apos;indirizzo indicato: apri il messaggio
            «Magistra – Conferma il tuo indirizzo email» e clicca sul pulsante. Se non lo trovi, controlla la posta
            indesiderata.
          </li>
          {privato ? (
            <li>
              <strong>Fatto!</strong> Dopo la conferma entri direttamente nel negozio e puoi completare il tuo ordine.
            </li>
          ) : (
            <>
              <li>
                <strong>Attendi l&apos;approvazione.</strong> La nostra amministrazione verifica i dati della farmacia e ti
                avvisa via email appena l&apos;iscrizione è attiva.
              </li>
              <li>
                <strong>Accedi a Magistra</strong> con la tua email e la password scelta per consultare prezzi e
                disponibilità.
              </li>
            </>
          )}
        </ol>
        <Link href={privato ? "/negozio" : "/"} className="btn btn-secondary mt-8">
          {privato ? "Torna al negozio" : "Torna alla home"}
        </Link>
      </div>
    </div>
  );
}
