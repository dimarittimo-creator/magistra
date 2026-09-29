export function PiePagina() {
  const anno = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-muted">
        <p className="font-serif italic text-base text-magistra-blu">Magistra – Semplicemente Magistrale</p>
        <p>© {anno} Sagè Pharma S.r.l. · Bioeleva S.r.l.</p>
      </div>
    </footer>
  );
}
