import { notFound } from "next/navigation";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { formattaIban, ibanValido } from "@/lib/validazione";
import { formattaData, formattaEuro } from "@/lib/formato";

export const metadata = { title: "Pagina di prova" };
export const dynamic = "force-dynamic";

// Pagina di controllo della Fase 0: grafica e dati iniziali del database.
// Disponibile solo in sviluppo locale.
export default async function Prova() {
  if (process.env.NODE_ENV === "production") notFound();
  const dati = await leggiDati();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-10">
      <header>
        <h1 className="text-4xl text-magistra-blu">
          Pagina di prova
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted max-w-3xl">
          Controllo della Fase 0: colori, caratteri e dati iniziali nel database. Visibile solo in locale.
        </p>
      </header>

      <section className="panel p-6 space-y-5">
        <h2 className="text-2xl">Pulsanti ed etichette</h2>
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" type="button">Pulsante principale</button>
          <button className="btn btn-secondary" type="button">Pulsante secondario</button>
          <button className="btn btn-primary" type="button" disabled>Disattivato</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="pill pill-ok">Disponibile</span>
          <span className="pill pill-warn">In esaurimento</span>
          <span className="pill pill-warn">Prezzo mancante</span>
          <span className="pill pill-bad">Mancante temporaneamente</span>
          <span className="pill pill-off">Non disponibile</span>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <Fascia colore="bg-fascia-1" testo="Fascia 1 – scadenza lunga" />
          <Fascia colore="bg-fascia-2" testo="Fascia 2 – scadenza media" />
          <Fascia colore="bg-fascia-3" testo="Fascia 3 – scadenza breve" />
        </div>
        <p role="alert" className="border-l-4 border-danger bg-danger-soft text-danger px-4 py-2 rounded">
          Esempio di avviso: difformità tra somma dei lotti e giacenza dichiarata.
        </p>
        <p className="text-muted">
          Formati: {formattaEuro(3664)} IVA esclusa · {formattaData(new Date())}
        </p>
      </section>

      <section className="panel p-6">
        <h2 className="text-2xl">Colori</h2>
        <ul className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
          {[
            ["bg-brand", "brand"],
            ["bg-magistra-rame", "magistra-rame"],
            ["bg-danger", "danger"],
            ["bg-slate", "slate"],
            ["bg-amber", "amber"],
            ["bg-ink", "ink"],
            ["bg-muted", "muted"],
          ].map(([classe, nome]) => (
            <li key={nome} className="flex items-center gap-2">
              <span className={`inline-block size-6 rounded border border-line ${classe}`} aria-hidden="true" />
              {nome}
            </li>
          ))}
        </ul>
      </section>

      {"errore" in dati ? (
        <section className="panel p-6 border-danger">
          <h2 className="text-2xl text-danger">Database non raggiungibile</h2>
          <p className="mt-3">{dati.errore}</p>
          <p className="mt-2 text-muted">Avvia il database con «npm run db:start» e poi «npm run db:env».</p>
        </section>
      ) : (
        <>
          <section className="panel p-6">
            <h2 className="text-2xl">Società ({dati.societa.length})</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {dati.societa.map((s) => (
                <article key={s.id} className="rounded-lg border border-line p-4">
                  <h3 className="text-xl">
                    {s.nome_breve} {s.predefinita && <span className="pill pill-ok align-middle">Predefinita</span>}
                  </h3>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted">Ragione sociale</dt><dd>{s.ragione_sociale}</dd>
                    <dt className="text-muted">Sede legale</dt>
                    <dd>{s.sede_legale_indirizzo} – {s.sede_legale_cap} {s.sede_legale_citta} ({s.sede_legale_provincia})</dd>
                    <dt className="text-muted">P.IVA / C.F.</dt><dd>{s.partita_iva}</dd>
                    <dt className="text-muted">SDI</dt><dd>{s.sdi}</dd>
                    <dt className="text-muted">PEC</dt><dd>{s.pec}</dd>
                    <dt className="text-muted">REA</dt><dd>{s.rea}</dd>
                    <dt className="text-muted">IBAN</dt>
                    <dd>
                      {s.iban ? (
                        <>
                          <span className="font-semibold">{formattaIban(s.iban)}</span>{" "}
                          {ibanValido(s.iban) ? <span className="pill pill-ok">Valido</span> : <span className="pill pill-bad">Non valido</span>}
                        </>
                      ) : (
                        <span className="pill pill-warn">Mancante</span>
                      )}
                    </dd>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="text-2xl">Sedi ({dati.sedi.length})</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="text-left text-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 pr-3 font-semibold">Società</th>
                    <th className="py-2 pr-3 font-semibold">Tipo</th>
                    <th className="py-2 pr-3 font-semibold">Nome</th>
                    <th className="py-2 pr-3 font-semibold">Indirizzo</th>
                    <th className="py-2 font-semibold">Operatore</th>
                  </tr>
                </thead>
                <tbody>
                  {dati.sedi.map((sede) => (
                    <tr key={sede.id} className="border-b border-line align-top">
                      <td className="py-2 pr-3">{sede.societa?.nome_breve}</td>
                      <td className="py-2 pr-3">
                        {sede.tipo}
                        {sede.predefinito && <span className="pill pill-ok ml-2">Predefinito</span>}
                      </td>
                      <td className="py-2 pr-3">{sede.nome}</td>
                      <td className="py-2 pr-3">{sede.indirizzo} – {sede.cap} {sede.citta} ({sede.provincia})</td>
                      <td className="py-2">
                        {sede.operatore ? `${sede.operatore.ragione_sociale} · ${sede.operatore.email}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Fascia({ colore, testo }: { colore: string; testo: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`inline-block size-4 rounded ${colore}`} aria-hidden="true" />
      {testo}
    </span>
  );
}

type Societa = {
  id: string;
  nome_breve: string;
  ragione_sociale: string;
  sede_legale_indirizzo: string;
  sede_legale_cap: string;
  sede_legale_citta: string;
  sede_legale_provincia: string;
  partita_iva: string;
  sdi: string | null;
  pec: string | null;
  rea: string | null;
  iban: string | null;
  predefinita: boolean;
};

type Sede = {
  id: string;
  tipo: string;
  nome: string;
  indirizzo: string;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
  predefinito: boolean;
  societa: { nome_breve: string } | null;
  operatore: { ragione_sociale: string; email: string | null } | null;
};

async function leggiDati(): Promise<{ societa: Societa[]; sedi: Sede[] } | { errore: string }> {
  try {
    const db = creaClientAdmin();
    const [societa, sedi] = await Promise.all([
      db.from("societa").select("*").order("predefinita", { ascending: false }),
      db
        .from("sedi")
        .select("*, societa:societa_id(nome_breve), operatore:operatore_id(ragione_sociale, email)")
        .order("tipo")
        .order("nome"),
    ]);
    if (societa.error) return { errore: societa.error.message };
    if (sedi.error) return { errore: sedi.error.message };
    return { societa: societa.data as Societa[], sedi: sedi.data as unknown as Sede[] };
  } catch (e) {
    return { errore: e instanceof Error ? e.message : String(e) };
  }
}
