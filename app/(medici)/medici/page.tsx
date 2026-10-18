import Link from "next/link";
import { richiediMedico } from "@/lib/auth";
import { formattaData } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";

export const metadata = { title: "Area Medici" };

export default async function AreaMedici() {
  const utente = await richiediMedico();
  const db = await creaClientServer();
  const { data: medico } = await db
    .from("medici")
    .select("nome, cognome, specializzazione, numero_iscrizione, ordine_provincia, stato, motivo_blocco, creato_il, struttura, indirizzo, cap, citta, provincia")
    .eq("id", utente.medicoId)
    .maybeSingle();

  if (!medico) {
    return (
      <Contenitore>
        <p className="avviso avviso-errore">Non troviamo i suoi dati. Contatti l&apos;amministrazione Magistra.</p>
      </Contenitore>
    );
  }

  return (
    <Contenitore>
      <h1 className="text-3xl text-magistra-blu">
        Dott. {medico.nome} {medico.cognome}
        <span className="filetto" aria-hidden="true" />
      </h1>

      {medico.stato === "in_attesa" && (
        <section className="panel p-6 mt-6 space-y-3" aria-labelledby="titolo-attesa">
          <p className="pill pill-warn">Accesso in attesa di approvazione</p>
          <h2 id="titolo-attesa" className="text-2xl">Stiamo verificando l&apos;iscrizione all&apos;Ordine</h2>
          <p className="text-muted">
            Ha inviato la richiesta il {formattaData(medico.creato_il)}. Appena la verifica è completata riceverà un&apos;email e da qui potrà consultare
            schede prodotto e materiale scientifico e richiedere campioni. Nel frattempo può controllare i suoi dati nel{" "}
            <Link href="/medici/profilo">profilo</Link>.
          </p>
        </section>
      )}

      {medico.stato === "bloccato" && (
        <section className="panel p-6 mt-6 space-y-3" aria-labelledby="titolo-bloccato">
          <p className="pill pill-bad">Accesso non attivo</p>
          <h2 id="titolo-bloccato" className="text-2xl">L&apos;accesso ai contenuti non è attivo</h2>
          {medico.motivo_blocco && <p>Motivo: {medico.motivo_blocco}</p>}
          <p className="text-muted">Per informazioni contatti l&apos;amministrazione Magistra.</p>
        </section>
      )}

      {medico.stato === "attivo" && (
        <section className="mt-6 grid gap-5 sm:grid-cols-3" aria-label="Contenuti dell'area Medici">
          <Riquadro titolo="Schede prodotto" testo="Composizione, formato e informazioni approvate dei prodotti Sagè Pharma e Bioeleva." href="/medici/prodotti" />
          <Riquadro titolo="Materiale scientifico" testo="Studi, brochure e schede tecniche da scaricare in PDF." href="/medici/materiale" />
          <Riquadro titolo="Campioni gratuiti" testo="Richieda i campioni da ricevere allo studio e segua lo stato delle richieste." href="/medici/campioni" />
        </section>
      )}

      {medico.stato === "attivo" && (
        <p className="mt-6 text-sm text-muted">
          Per domande sui prodotti può usare l&apos;assistente virtuale, in basso a destra: risponde solo con le informazioni approvate dal gruppo.
        </p>
      )}

      <section className="panel p-6 mt-6" aria-labelledby="titolo-dati">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="titolo-dati" className="text-2xl">I suoi dati</h2>
          <Link href="/medici/profilo" className="btn btn-secondary btn-piccolo">Modifica</Link>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr] text-sm">
          <dt className="text-muted">Specializzazione</dt>
          <dd>{medico.specializzazione}</dd>
          <dt className="text-muted">Iscrizione all&apos;Ordine</dt>
          <dd>{medico.ordine_provincia} n. {medico.numero_iscrizione}</dd>
          <dt className="text-muted">Studio</dt>
          <dd>{[medico.struttura, medico.indirizzo, `${medico.cap} ${medico.citta} (${medico.provincia})`].filter(Boolean).join(" – ")}</dd>
        </dl>
      </section>
    </Contenitore>
  );
}

function Riquadro(p: { titolo: string; testo: string; href: string }) {
  return (
    <Link href={p.href} className="panel p-5 flex flex-col no-underline hover:border-brand text-ink">
      <h2 className="text-xl text-magistra-blu">{p.titolo}</h2>
      <p className="mt-2 text-sm text-muted flex-1">{p.testo}</p>
      <span className="mt-4 text-sm font-semibold">Apri →</span>
    </Link>
  );
}

function Contenitore({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">{children}</div>;
}
