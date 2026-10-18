import Link from "next/link";
import { richiediStaff } from "@/lib/auth";
import { formattaData } from "@/lib/formato";
import { STATI_MEDICO } from "@/lib/medici/dati";
import { creaClientServer } from "@/lib/supabase/server";

export const metadata = { title: "Medici" };

const FILTRI = [
  { valore: "in_attesa", testo: "Da approvare" },
  { valore: "attivo", testo: "Attivi" },
  { valore: "bloccato", testo: "Non attivi" },
  { valore: "tutti", testo: "Tutti" },
];

export default async function ElencoMedici({ searchParams }: { searchParams: Promise<{ stato?: string; q?: string }> }) {
  await richiediStaff();
  const parametri = await searchParams;
  const stato = FILTRI.find((f) => f.valore === parametri.stato)?.valore ?? "in_attesa";
  const ricerca = (parametri.q ?? "").replace(/[,()%*\\]/g, " ").trim();

  const db = await creaClientServer();
  let query = db
    .from("medici")
    .select("id, nome, cognome, specializzazione, numero_iscrizione, ordine_provincia, citta, provincia, stato, creato_il")
    .order("creato_il", { ascending: stato === "in_attesa" })
    .limit(200);
  if (stato !== "tutti") query = query.eq("stato", stato);
  if (ricerca) query = query.or(`cognome.ilike.%${ricerca}%,nome.ilike.%${ricerca}%,numero_iscrizione.ilike.%${ricerca}%,specializzazione.ilike.%${ricerca}%,citta.ilike.%${ricerca}%`);
  const { data: medici, error } = await query;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl text-magistra-blu">
        Medici
        <span className="filetto" aria-hidden="true" />
      </h1>
      <p className="text-muted">
        Prima di approvare verifica l&apos;iscrizione sull&apos;albo pubblico FNOMCeO (portale.fnomceo.it, «Ricerca anagrafica»). Vedi anche{" "}
        <Link href="/admin/medici/materiale">Materiale scientifico</Link> e <Link href="/admin/medici/campioni">Richieste campioni</Link>.
      </p>

      <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
        <nav aria-label="Filtra per stato" className="flex flex-wrap gap-2">
          {FILTRI.map((f) => (
            <Link
              key={f.valore}
              href={`/admin/medici?stato=${f.valore}${ricerca ? `&q=${encodeURIComponent(ricerca)}` : ""}`}
              aria-current={f.valore === stato ? "page" : undefined}
              className={`btn btn-piccolo ${f.valore === stato ? "btn-primary" : "btn-secondary"}`}
            >
              {f.testo}
            </Link>
          ))}
        </nav>
        <form role="search" className="flex gap-2 w-full lg:w-auto" action="/admin/medici">
          <input type="hidden" name="stato" value={stato} />
          <label htmlFor="cerca-medico" className="sr-only">Cerca per nome, iscrizione, specializzazione o città</label>
          <input id="cerca-medico" name="q" defaultValue={ricerca} placeholder="Cognome, iscrizione, città" className="input lg:w-72" />
          <button type="submit" className="btn btn-secondary">Cerca</button>
        </form>
      </div>

      {error && <p className="avviso avviso-errore">Errore nel caricamento: {error.message}</p>}

      <div className="panel p-4 sm:p-6 overflow-x-auto">
        {!medici?.length ? (
          <p className="text-muted">Nessun medico trovato.</p>
        ) : (
          <table className="tabella min-w-[760px]">
            <thead>
              <tr>
                <th>Medico</th>
                <th>Specializzazione</th>
                <th>Iscrizione all&apos;Ordine</th>
                <th>Città</th>
                <th>Stato</th>
                <th>Richiesta del</th>
              </tr>
            </thead>
            <tbody>
              {medici.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/admin/medici/${m.id}`} className="font-semibold">{m.cognome} {m.nome}</Link>
                  </td>
                  <td>{m.specializzazione}</td>
                  <td>{m.ordine_provincia} n. {m.numero_iscrizione}</td>
                  <td>{m.citta} ({m.provincia})</td>
                  <td><span className={`pill ${STATI_MEDICO[m.stato].classe}`}>{STATI_MEDICO[m.stato].testo}</span></td>
                  <td>{formattaData(m.creato_il)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
