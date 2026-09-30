import Link from "next/link";
import { notFound } from "next/navigation";
import { Disponibilita, PrezzoNegozio } from "@/components/negozio/PrezzoNegozio";
import { utenteCorrente } from "@/lib/auth";
import { caricaNegozio, perIlCliente } from "@/lib/negozio";
import { AggiungiProdotto } from "./AggiungiProdotto";

export const metadata = { title: "Prodotto" };

export default async function SchedaNegozio({ params }: { params: Promise<{ codice: string }> }) {
  const { codice } = await params;
  if (!/^\d{9}$/.test(codice)) notFound();
  const [negozio, utente] = await Promise.all([caricaNegozio({ codice }), utenteCorrente()]);
  const interno = negozio.prodotti[0];
  if (!interno) notFound();
  const p = perIlCliente(interno);
  const cliente = utente?.profilo?.ruolo === "privato";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <p><Link href="/negozio">← Negozio</Link></p>
      <article className="panel p-6 sm:p-8 grid gap-8 md:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-4xl text-magistra-blu">
            {p.nome}
            <span className="filetto" aria-hidden="true" />
          </h1>
          {p.formato && <p className="text-muted">{p.formato}</p>}
          {p.linea && <p className="text-sm text-muted">Linea {p.linea.nome}</p>}
          {p.descrizione ? <p className="leading-relaxed">{p.descrizione}</p> : <p className="text-muted">Integratore alimentare.</p>}
          <p className="text-xs text-muted">
            Gli integratori non vanno intesi come sostituti di una dieta variata ed equilibrata e di uno stile di vita sano. Per consigli sul tuo caso chiedi
            al medico o al farmacista.
          </p>
        </div>
        <aside className="space-y-4 md:border-l md:border-line md:pl-8">
          <PrezzoNegozio prezzo={p.prezzo} grande />
          <Disponibilita disponibile={p.disponibile} />
          {p.disponibile &&
            (cliente ? (
              <AggiungiProdotto codice={p.codice} />
            ) : (
              <div className="space-y-2">
                <Link href={`/accesso?area=privati&prossima=${encodeURIComponent(`/negozio/${p.codice}`)}`} className="btn btn-primary w-full">
                  Accedi per ordinare
                </Link>
                <p className="text-sm text-muted text-center">
                  Prima volta? <Link href={`/registrazione/privato?prossima=${encodeURIComponent(`/negozio/${p.codice}`)}`}>Crea il tuo account</Link>
                </p>
              </div>
            ))}
          <p className="text-sm text-muted">Consegna indicativa entro {negozio.giorniConsegna} giorni lavorativi dalla conferma dell&apos;ordine.</p>
        </aside>
      </article>
    </div>
  );
}
