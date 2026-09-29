import { richiediAdmin } from "@/lib/auth";
import { formattaDataOra } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";

export const metadata = { title: "Registro operazioni" };

const AZIONI: Record<string, string> = {
  approva_farmacia: "Iscrizione approvata",
  riattiva_farmacia: "Farmacia riattivata",
  rifiuta_farmacia: "Iscrizione rifiutata",
  blocca_farmacia: "Farmacia bloccata",
  modifica_condizioni_farmacia: "Gruppo / società della farmacia modificati",
  modifica_dati_farmacia: "Dati della farmacia corretti",
  crea_gruppo: "Gruppo creato",
  modifica_gruppo: "Gruppo modificato",
  modifica_societa: "Dati della società modificati",
  crea_sede: "Sede creata",
  modifica_sede: "Sede modificata",
};

const ENTITA: Record<string, { tabella: string; campo: string; link: (id: string) => string }> = {
  farmacie: { tabella: "farmacie", campo: "ragione_sociale", link: (id) => `/admin/farmacie/${id}` },
  societa: { tabella: "societa", campo: "nome_breve", link: (id) => `/admin/societa/${id}` },
  sedi: { tabella: "sedi", campo: "nome", link: (id) => `/admin/sedi/${id}` },
  gruppi: { tabella: "gruppi", campo: "nome", link: () => "/admin/gruppi" },
};

export default async function Registro() {
  await richiediAdmin();
  const db = await creaClientServer();
  const { data: righe } = await db
    .from("registro_operazioni")
    .select("id, utente, azione, entita, entita_id, il")
    .order("il", { ascending: false })
    .limit(300);

  // Nomi leggibili di utenti e record coinvolti.
  const idUtenti = [...new Set((righe ?? []).map((r) => r.utente).filter(Boolean))] as string[];
  const { data: utenti } = idUtenti.length
    ? await db.from("profili_utente").select("id, nome, email").in("id", idUtenti)
    : { data: [] };
  const nomeUtente = new Map((utenti ?? []).map((u) => [u.id, u.nome || u.email]));

  const nomiRecord = new Map<string, string>();
  await Promise.all(
    Object.entries(ENTITA).map(async ([entita, conf]) => {
      const ids = [...new Set((righe ?? []).filter((r) => r.entita === entita && r.entita_id).map((r) => r.entita_id as string))];
      if (!ids.length) return;
      const { data } = await db.from(conf.tabella).select(`id, ${conf.campo}`).in("id", ids);
      for (const r of (data ?? []) as unknown as Record<string, string>[]) nomiRecord.set(`${entita}:${r.id}`, r[conf.campo]);
    }),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Registro operazioni
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted max-w-3xl">
          Tutte le azioni svolte nell&apos;area amministrazione, dalla più recente. Il registro non si può modificare né
          cancellare.
        </p>
      </header>
      <div className="panel p-4 sm:p-6 overflow-x-auto">
        {!righe?.length ? (
          <p className="text-muted">Nessuna operazione registrata.</p>
        ) : (
          <table className="tabella min-w-[640px]">
            <thead>
              <tr>
                <th>Data e ora</th>
                <th>Utente</th>
                <th>Operazione</th>
                <th>Riferimento</th>
              </tr>
            </thead>
            <tbody>
              {righe.map((r) => {
                const conf = ENTITA[r.entita];
                const nome = r.entita_id ? nomiRecord.get(`${r.entita}:${r.entita_id}`) : undefined;
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{formattaDataOra(r.il)}</td>
                    <td>{(r.utente && nomeUtente.get(r.utente)) || "—"}</td>
                    <td>{AZIONI[r.azione] ?? r.azione}</td>
                    <td>
                      {conf && r.entita_id ? <a href={conf.link(r.entita_id)}>{nome ?? r.entita}</a> : r.entita}
                    </td>
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
