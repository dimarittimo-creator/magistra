import Link from "next/link";
import { richiediFarmacia } from "@/lib/auth";
import { formattaData } from "@/lib/formato";
import { formattaIndirizzo, indirizzoDi, leggiFarmacia } from "@/lib/farmacie/lettura";
import { creaClientServer } from "@/lib/supabase/server";

export const metadata = { title: "Area farmacia" };

export default async function AreaFarmacia() {
  const utente = await richiediFarmacia();
  const db = await creaClientServer();
  const farmacia = utente.profilo.farmacia_id ? await leggiFarmacia(db, utente.profilo.farmacia_id) : null;

  if (!farmacia) {
    return (
      <Contenitore>
        <p className="avviso avviso-errore">Non troviamo i dati della tua farmacia. Contatta l&apos;amministrazione Magistra.</p>
      </Contenitore>
    );
  }

  return (
    <Contenitore>
      <h1 className="text-3xl text-magistra-blu">
        {farmacia.ragione_sociale}
        <span className="filetto" aria-hidden="true" />
      </h1>

      {farmacia.stato === "in_attesa" && (
        <section className="panel p-6 mt-6 space-y-3" aria-labelledby="titolo-attesa">
          <p className="pill pill-warn">Iscrizione in attesa di approvazione</p>
          <h2 id="titolo-attesa" className="text-2xl">Stiamo verificando i tuoi dati</h2>
          <p className="text-muted">
            Hai inviato la richiesta il {formattaData(farmacia.creato_il)}. Appena l&apos;amministrazione approva
            l&apos;iscrizione riceverai un&apos;email e da qui potrai consultare prezzi e disponibilità dei lotti.
            Nel frattempo puoi controllare e correggere i tuoi dati nel <Link href="/farmacia/profilo">profilo</Link>.
          </p>
        </section>
      )}

      {farmacia.stato === "bloccata" && (
        <section className="panel p-6 mt-6 space-y-3" aria-labelledby="titolo-bloccata">
          <p className="pill pill-bad">Account non attivo</p>
          <h2 id="titolo-bloccata" className="text-2xl">L&apos;accesso al catalogo non è attivo</h2>
          {farmacia.motivo_blocco && <p>Motivo: {farmacia.motivo_blocco}</p>}
          <p className="text-muted">Per informazioni contatta l&apos;amministrazione Magistra.</p>
        </section>
      )}

      {farmacia.stato === "attiva" && (
        <section className="panel p-6 mt-6 space-y-3" aria-labelledby="titolo-attiva">
          <p className="pill pill-ok">Iscrizione attiva</p>
          <h2 id="titolo-attiva" className="text-2xl">Benvenuto in Magistra</h2>
          <p className="text-muted">
            Consulta il catalogo con lotti, scadenze e prezzi riservati e invia le tue prenotazioni d&apos;ordine.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/farmacia/catalogo" className="btn btn-primary">Apri il catalogo</Link>
            <Link href="/farmacia/ordini" className="btn btn-secondary">I miei ordini</Link>
          </div>
        </section>
      )}

      <section className="panel p-6 mt-6" aria-labelledby="titolo-dati">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="titolo-dati" className="text-2xl">I tuoi dati</h2>
          <Link href="/farmacia/profilo" className="btn btn-secondary btn-piccolo">
            Modifica
          </Link>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr] text-sm">
          <dt className="text-muted">Titolare</dt>
          <dd>{farmacia.titolare}</dd>
          <dt className="text-muted">Partita IVA</dt>
          <dd>{farmacia.partita_iva}</dd>
          <dt className="text-muted">Codice farmacia</dt>
          <dd>{farmacia.codice_farmacia}</dd>
          <dt className="text-muted">Consegna</dt>
          <dd>{formattaIndirizzo(indirizzoDi(farmacia, "consegna"))}</dd>
          <dt className="text-muted">Fatturazione</dt>
          <dd>{formattaIndirizzo(indirizzoDi(farmacia, "fatturazione"))}</dd>
        </dl>
      </section>
    </Contenitore>
  );
}

function Contenitore({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">{children}</div>;
}
