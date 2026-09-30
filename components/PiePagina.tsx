import Link from "next/link";

export function PiePagina() {
  const anno = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm text-muted">
        <p className="font-serif italic text-base text-magistra-blu">Magistra – Semplicemente Magistrale</p>
        <nav aria-label="Informazioni legali" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/privacy">Informativa privacy</Link>
          <Link href="/condizioni/farmacie">Condizioni di vendita farmacie</Link>
          <Link href="/condizioni/privati">Condizioni di vendita privati</Link>
          <Link href="/chi-siamo">Chi siamo</Link>
        </nav>
        <p>© {anno} Sagè Pharma S.r.l. · Bioeleva S.r.l.</p>
      </div>
    </footer>
  );
}
