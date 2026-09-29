import Link from "next/link";
import { redirect } from "next/navigation";
import { paginaIniziale, utenteCorrente } from "@/lib/auth";
import { documentoCorrente } from "@/lib/documenti-legali";
import { FormRegistrazione } from "./FormRegistrazione";

export const metadata = { title: "Iscrizione farmacia" };

export default async function Registrazione() {
  const utente = await utenteCorrente();
  if (utente) redirect(paginaIniziale(utente.profilo?.ruolo));

  const [privacy, condizioni] = await Promise.all([documentoCorrente("privacy"), documentoCorrente("condizioni_farmacie")]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="panel p-6 sm:p-10">
        <h1 className="text-3xl text-magistra-blu">
          Iscrizione della farmacia
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted">
          Compila i dati della farmacia. La richiesta resta in attesa finché la nostra amministrazione non la verifica:
          riceverai un&apos;email quando l&apos;iscrizione sarà approvata. Hai già un account?{" "}
          <Link href="/accesso">Accedi</Link>.
        </p>
        <div className="mt-8">
          {privacy && condizioni ? (
            <FormRegistrazione versionePrivacy={privacy.versione} versioneCondizioni={condizioni.versione} />
          ) : (
            <p className="avviso avviso-errore">
              Le iscrizioni sono momentaneamente sospese. Riprova più tardi.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
