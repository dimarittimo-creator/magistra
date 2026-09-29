import Image from "next/image";
import Link from "next/link";

// Intestazione su fascia bianca anche in modalità scura (docs/GRAFICA.md):
// il logo Magistra va sempre su fondo bianco.
export function Intestazione() {
  return (
    <header className="bg-white border-b border-[#dfe4e6]">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex flex-col no-underline" aria-label="Magistra – Semplicemente Magistrale, vai alla home">
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
        <span className="text-xs sm:text-sm whitespace-nowrap text-[#5a6a70] text-right">Sagè Pharma · Bioeleva</span>
      </div>
    </header>
  );
}
