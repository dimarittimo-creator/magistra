import Image from "next/image";
import Link from "next/link";
import { esci } from "@/app/azioni-sessione";
import { paginaIniziale, utenteCorrente } from "@/lib/auth";

// Intestazione su fascia bianca anche in modalità scura (docs/GRAFICA.md):
// il logo Magistra va sempre su fondo bianco. Per questo i colori qui sono fissi.
export async function Intestazione() {
  const utente = await utenteCorrente();
  const ruolo = utente?.profilo?.ruolo;

  return (
    <header className="bg-white border-b border-[#dfe4e6]">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex flex-col no-underline shrink-0" aria-label="Magistra – Semplicemente Magistrale, vai alla home">
          {/* Tablet e desktop: logo completo con pay off */}
          <Image
            src="/brand/logo-magistra.png"
            alt="Magistra – Semplicemente Magistrale"
            width={782}
            height={224}
            priority
            className="hidden sm:block h-14 w-auto"
          />
          {/* Smartphone: logo senza pay off, pay off come riga separata */}
          <Image
            src="/brand/logo-magistra-compatto.png"
            alt="Magistra"
            width={778}
            height={184}
            priority
            className="sm:hidden h-9 w-auto"
          />
          <span className="sm:hidden mt-0.5 text-[0.6rem] tracking-[0.12em] uppercase whitespace-nowrap text-[#5a6a70]">
            Semplicemente Magistrale
          </span>
        </Link>

        <div className="flex flex-col items-end gap-1.5 text-right min-w-0">
          <span className="hidden sm:block text-sm whitespace-nowrap text-[#5a6a70]">Sagè Pharma · Bioeleva</span>
          {utente ? (
            <div className="flex items-center gap-2 sm:gap-3 text-sm">
              <span className="hidden md:inline text-[#5a6a70] truncate max-w-56" title={utente.email}>
                {utente.profilo?.nome || utente.email}
              </span>
              <Link
                href={paginaIniziale(ruolo)}
                className="font-semibold text-[#022976] whitespace-nowrap"
              >
                {ruolo === "admin" || ruolo === "operatore" ? "Amministrazione" : "Area riservata"}
              </Link>
              <form action={esci}>
                <button
                  type="submit"
                  className="rounded-md border border-[#022976] px-2.5 py-1 font-semibold text-[#022976] hover:bg-[#e6ebf5] cursor-pointer"
                >
                  Esci
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/accesso"
              className="rounded-md bg-[#022976] px-3 py-1.5 text-sm font-semibold text-white no-underline hover:bg-[#0a3a9a]"
            >
              Accedi
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
