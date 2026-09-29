import Link from "next/link";
import { richiediStaff } from "@/lib/auth";
import { formattaData } from "@/lib/formato";
import { ETICHETTE_STATO, type StatoFarmacia } from "@/lib/farmacie/lettura";
import { creaClientServer } from "@/lib/supabase/server";

export const metadata = { title: "Farmacie" };

const FILTRI: { valore: StatoFarmacia | "tutte"; testo: string }[] = [
  { valore: "in_attesa", testo: "Da approvare" },
  { valore: "attiva", testo: "Attive" },
  { valore: "bloccata", testo: "Bloccate" },
  { valore: "tutte", testo: "Tutte" },
];

type Riga = {
  id: string;
  ragione_sociale: string;
  partita_iva: string;
  codice_farmacia: string;
  stato: StatoFarmacia;
  creato_il: string;
  gruppo: { nome: string } | null;
  indirizzi: { tipo: string; citta: string; provincia: string }[];
};

export default async function ElencoFarmacie({ searchParams }: { searchParams: Promise<{ stato?: string; q?: string }> }) {
  await richiediStaff();
  const parametri = await searchParams;
  const stato = (FILTRI.find((f) => f.valore === parametri.stato)?.valore ?? "in_attesa") as StatoFarmacia | "tutte";
  // Tolgo i caratteri che hanno un significato nei filtri di PostgREST.
  const ricerca = (parametri.q ?? "").replace(/[,()%*\\]/g, " ").trim();

  const db = await creaClientServer();
  let query = db
    .from("farmacie")
    .select("id, ragione_sociale, partita_iva, codice_farmacia, stato, creato_il, gruppo:gruppo_id(nome), indirizzi(tipo, citta, provincia)")
    .order("creato_il", { ascending: stato === "in_attesa" })
    .limit(200);
  if (stato !== "tutte") query = query.eq("stato", stato);
  if (ricerca) {
    query = query.or(`ragione_sociale.ilike.%${ricerca}%,partita_iva.ilike.%${ricerca}%,codice_farmacia.ilike.%${ricerca}%,titolare.ilike.%${ricerca}%`);
  }
  const { data, error } = await query;
  const farmacie = (data ?? []) as unknown as Riga[];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl text-magistra-blu">
        Farmacie
        <span className="filetto" aria-hidden="true" />
      </h1>

      <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
        <nav aria-label="Filtra per stato" className="flex flex-wrap gap-2">
          {FILTRI.map((f) => (
            <Link
              key={f.valore}
              href={`/admin/farmacie?stato=${f.valore}${ricerca ? `&q=${encodeURIComponent(ricerca)}` : ""}`}
              aria-current={f.valore === stato ? "page" : undefined}
              className={`btn btn-piccolo ${f.valore === stato ? "btn-primary" : "btn-secondary"}`}
            >
              {f.testo}
            </Link>
          ))}
        </nav>
        <form role="search" className="flex gap-2 w-full lg:w-auto" action="/admin/farmacie">
          <input type="hidden" name="stato" value={stato} />
          <label htmlFor="cerca-farmacia" className="sr-only">
            Cerca per nome, partita IVA, codice farmacia o titolare
          </label>
          <input
            id="cerca-farmacia"
            name="q"
            defaultValue={ricerca}
            placeholder="Nome, P.IVA, codice, titolare"
            className="input lg:w-72"
          />
          <button type="submit" className="btn btn-secondary">
            Cerca
          </button>
        </form>
      </div>

      {error && <p className="avviso avviso-errore">Errore nel caricamento: {error.message}</p>}

      <div className="panel p-4 sm:p-6 overflow-x-auto">
        {farmacie.length === 0 ? (
          <p className="text-muted">Nessuna farmacia trovata.</p>
        ) : (
          <table className="tabella min-w-[760px]">
            <thead>
              <tr>
                <th>Farmacia</th>
                <th>Città</th>
                <th>Partita IVA</th>
                <th>Codice</th>
                <th>Gruppo</th>
                <th>Stato</th>
                <th>Iscritta il</th>
              </tr>
            </thead>
            <tbody>
              {farmacie.map((f) => {
                const consegna = f.indirizzi.find((i) => i.tipo === "consegna");
                return (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/admin/farmacie/${f.id}`} className="font-semibold">
                        {f.ragione_sociale}
                      </Link>
                    </td>
                    <td>{consegna ? `${consegna.citta} (${consegna.provincia})` : "—"}</td>
                    <td>{f.partita_iva}</td>
                    <td>{f.codice_farmacia}</td>
                    <td>{f.gruppo?.nome ?? "—"}</td>
                    <td>
                      <span className={`pill ${ETICHETTE_STATO[f.stato].classe}`}>{ETICHETTE_STATO[f.stato].testo}</span>
                    </td>
                    <td>{formattaData(f.creato_il)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
