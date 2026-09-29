import Link from "next/link";

export const metadata = { title: "Accesso" };

// Segnaposto: registrazione e accesso arrivano nella Fase 1.
export default async function Accesso({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const { area } = await searchParams;
  const nomeArea = area === "privati" ? "Privati" : "Farmacie";
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="panel p-8">
        <h1 className="text-3xl text-magistra-blu">
          Area {nomeArea}
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-5 text-muted">
          L&apos;accesso e la registrazione saranno disponibili a breve.
        </p>
        <Link href="/" className="btn btn-secondary mt-6">
          Torna alla home
        </Link>
      </div>
    </div>
  );
}
