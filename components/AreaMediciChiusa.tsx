import Link from "next/link";

export function AreaMediciChiusa() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="panel p-6 sm:p-8">
        <h1 className="text-3xl text-magistra-blu">
          Area Medici
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-5 text-muted">L&apos;area riservata ai medici sarà disponibile a breve.</p>
        <Link href="/" className="btn btn-secondary mt-6">Torna alla home</Link>
      </div>
    </div>
  );
}
