import Link from "next/link";
import { redirect } from "next/navigation";
import { paginaIniziale, utenteCorrente } from "@/lib/auth";
import { documentoCorrente } from "@/lib/documenti-legali";
import { FormRegistrazioneMedico } from "./FormRegistrazioneMedico";

export const metadata = { title: "Accesso all'area Medici" };

export default async function RegistrazioneMedico() {
  const utente = await utenteCorrente();
  if (utente) redirect(paginaIniziale(utente.profilo?.ruolo));
  const privacy = await documentoCorrente("privacy");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="panel p-6 sm:p-10">
        <h1 className="text-3xl text-magistra-blu">
          Richiesta di accesso per i medici
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted">
          L&apos;area Medici offre schede prodotto, materiale scientifico, un assistente virtuale e la richiesta di campioni gratuiti. Dopo la
          conferma dell&apos;email verifichiamo l&apos;iscrizione all&apos;Ordine e attiviamo l&apos;accesso. Ha già un account?{" "}
          <Link href="/accesso?area=medici">Accedi</Link>.
        </p>
        <div className="mt-8">
          {privacy ? <FormRegistrazioneMedico versionePrivacy={privacy.versione} /> : <p className="avviso avviso-info">Iscrizioni non ancora aperte.</p>}
        </div>
      </div>
    </div>
  );
}
