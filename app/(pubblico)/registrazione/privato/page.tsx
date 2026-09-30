import Link from "next/link";
import { redirect } from "next/navigation";
import { paginaIniziale, utenteCorrente } from "@/lib/auth";
import { documentoCorrente } from "@/lib/documenti-legali";
import { areaPrivatiAperta } from "@/lib/negozio";
import { FormRegistrazionePrivato } from "./FormRegistrazionePrivato";

export const metadata = { title: "Crea il tuo account" };

export default async function RegistrazionePrivato({ searchParams }: { searchParams: Promise<{ prossima?: string }> }) {
  const utente = await utenteCorrente();
  if (utente) redirect(paginaIniziale(utente.profilo?.ruolo));
  const { prossima } = await searchParams;
  const [aperta, privacy, condizioni] = await Promise.all([areaPrivatiAperta(), documentoCorrente("privacy"), documentoCorrente("condizioni_privati")]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="panel p-6 sm:p-10">
        <h1 className="text-3xl text-magistra-blu">
          Crea il tuo account
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted">
          Ti servirà per ordinare e seguire le spedizioni. Dopo la registrazione conferma l&apos;email e l&apos;account è subito attivo. Hai già un
          account? <Link href={`/accesso?area=privati${prossima ? `&prossima=${encodeURIComponent(prossima)}` : ""}`}>Accedi</Link>.
        </p>
        <div className="mt-8">
          {aperta && privacy && condizioni ? (
            <FormRegistrazionePrivato versionePrivacy={privacy.versione} versioneCondizioni={condizioni.versione} prossima={prossima} />
          ) : (
            <p className="avviso avviso-info">Il negozio per i privati aprirà a breve.</p>
          )}
        </div>
      </div>
    </div>
  );
}
