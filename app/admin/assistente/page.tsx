import Link from "next/link";
import { richiediStaff } from "@/lib/auth";
import { formattaDataOra } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";
import { NavAssistente } from "./NavAssistente";

export const metadata = { title: "Assistente – richieste e conversazioni" };

type Riga = {
  id: string;
  stato: "aperta" | "operatore" | "chiusa";
  modalita: string;
  creata_il: string;
  ultimo_messaggio_il: string;
  farmacia: { ragione_sociale: string; codice_farmacia: string | null } | null;
  privato: { nome: string; cognome: string } | null;
  messaggi: { count: number }[];
  richieste_operatore: { id: string; motivo: string; stato: string; creata_il: string }[];
};

const STATO: Record<Riga["stato"], { testo: string; classe: string }> = {
  aperta: { testo: "Con l'assistente", classe: "pill-ok" },
  operatore: { testo: "Con operatore", classe: "pill-warn" },
  chiusa: { testo: "Chiusa", classe: "pill-off" },
};

export default async function PannelloAssistente() {
  const utente = await richiediStaff();
  const db = await creaClientServer();
  const { data } = await db
    .from("conversazioni")
    .select("id, stato, modalita, creata_il, ultimo_messaggio_il, farmacia:farmacia_id(ragione_sociale, codice_farmacia), privato:privato_id(nome, cognome), messaggi(count), richieste_operatore(id, motivo, stato, creata_il)")
    .order("ultimo_messaggio_il", { ascending: false })
    .limit(100);
  const righe = (data ?? []) as unknown as Riga[];
  const cliente = (r: Riga) => (r.farmacia ? `${r.farmacia.ragione_sociale}${r.farmacia.codice_farmacia ? ` (${r.farmacia.codice_farmacia})` : ""}` : r.privato ? `${r.privato.nome} ${r.privato.cognome}` : "—");
  const richieste = righe
    .flatMap((r) => r.richieste_operatore.filter((q) => q.stato === "aperta").map((q) => ({ ...q, conversazione: r })))
    .sort((a, b) => a.creata_il.localeCompare(b.creata_il));

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <h1 className="text-3xl text-magistra-blu">
          Assistente
          <span className="filetto" aria-hidden="true" />
        </h1>
        <NavAssistente attiva="/admin/assistente" admin={utente.profilo.ruolo === "admin"} />
      </header>

      <section className="panel p-6" aria-labelledby="t-richieste">
        <h2 id="t-richieste" className="text-2xl text-magistra-blu">
          Richieste di operatore aperte
        </h2>
        {richieste.length === 0 ? (
          <p className="mt-3 text-muted">Nessuna richiesta in attesa.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {richieste.map((q) => (
              <li key={q.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{cliente(q.conversazione)}</p>
                  <p className="text-sm">{q.motivo}</p>
                  <p className="text-sm text-muted">In attesa dal {formattaDataOra(q.creata_il)}</p>
                </div>
                <Link href={`/admin/assistente/${q.conversazione.id}`} className="btn btn-primary btn-piccolo">
                  Rispondi
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-6" aria-labelledby="t-storico">
        <h2 id="t-storico" className="text-2xl text-magistra-blu">
          Storico conversazioni
        </h2>
        <p className="text-sm text-muted mt-1">Ultime 100. Le conversazioni si cancellano da sole dopo il periodo di conservazione indicato nelle impostazioni.</p>
        {righe.length === 0 ? (
          <p className="mt-3 text-muted">Ancora nessuna conversazione.</p>
        ) : (
          <div className="overflow-x-auto mt-3">
            <table className="tabella">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Iniziata</th>
                  <th>Ultimo messaggio</th>
                  <th>Messaggi</th>
                  <th>Stato</th>
                  <th>
                    <span className="sr-only">Azioni</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {righe.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {cliente(r)}
                      {r.modalita === "prova" && <span className="pill pill-off ml-2">Prova</span>}
                    </td>
                    <td>{formattaDataOra(r.creata_il)}</td>
                    <td>{formattaDataOra(r.ultimo_messaggio_il)}</td>
                    <td>{r.messaggi[0]?.count ?? 0}</td>
                    <td>
                      <span className={`pill ${STATO[r.stato].classe}`}>{STATO[r.stato].testo}</span>
                    </td>
                    <td>
                      <Link href={`/admin/assistente/${r.id}`}>Apri</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
