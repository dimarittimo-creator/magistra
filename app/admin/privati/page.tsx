import { richiediStaff } from "@/lib/auth";
import { formattaData } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";
import { cambiaStatoPrivato } from "./azioni";

export const metadata = { title: "Clienti privati" };

export default async function ClientiPrivati({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const utente = await richiediStaff();
  const { q } = await searchParams;
  const cerca = (q ?? "").replace(/[,()%*\\]/g, " ").trim();
  const db = await creaClientServer();
  let query = db.from("privati").select("id, nome, cognome, codice_fiscale, email, telefono, stato, creato_il, indirizzi(tipo, citta, provincia), ordini(count)").order("creato_il", { ascending: false }).limit(300);
  if (cerca) query = query.or(`nome.ilike.%${cerca}%,cognome.ilike.%${cerca}%,email.ilike.%${cerca}%,codice_fiscale.ilike.%${cerca}%`);
  const { data } = await query;
  const clienti = (data ?? []) as unknown as {
    id: string; nome: string; cognome: string; codice_fiscale: string; email: string; telefono: string; stato: "attivo" | "bloccato"; creato_il: string;
    indirizzi: { tipo: string; citta: string; provincia: string }[]; ordini: { count: number }[];
  }[];
  const admin = utente.profilo.ruolo === "admin";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-magistra-blu">Clienti privati<span className="filetto" aria-hidden="true" /></h1>
          <p className="mt-4 text-muted">L&apos;account è attivo dopo la conferma dell&apos;email; puoi bloccarlo in qualsiasi momento.</p>
        </div>
        <form role="search" className="flex gap-2">
          <label htmlFor="q" className="sr-only">Cerca cliente</label>
          <input id="q" name="q" defaultValue={q} placeholder="Nome, email, codice fiscale" className="input w-64" />
          <button type="submit" className="btn btn-secondary">Cerca</button>
        </form>
      </header>
      <div className="panel p-4 sm:p-6 overflow-x-auto">
        {clienti.length === 0 ? (
          <p className="text-muted">Nessun cliente.</p>
        ) : (
          <table className="tabella text-sm min-w-[760px]">
            <thead><tr><th>Cliente</th><th>Contatti</th><th>Città</th><th className="text-right">Ordini</th><th>Dal</th><th>Stato</th>{admin && <th />}</tr></thead>
            <tbody>
              {clienti.map((c) => {
                const sped = c.indirizzi.find((i) => i.tipo === "consegna");
                return (
                  <tr key={c.id}>
                    <td className="font-semibold">{c.nome} {c.cognome}<div className="text-xs text-muted font-normal">C.F. {c.codice_fiscale}</div></td>
                    <td>{c.email}<div className="text-xs text-muted">{c.telefono}</div></td>
                    <td>{sped ? `${sped.citta} (${sped.provincia})` : "—"}</td>
                    <td className="text-right">{c.ordini[0]?.count ?? 0}</td>
                    <td>{formattaData(c.creato_il)}</td>
                    <td>{c.stato === "attivo" ? <span className="pill pill-ok">Attivo</span> : <span className="pill pill-bad">Bloccato</span>}</td>
                    {admin && (
                      <td>
                        <form action={cambiaStatoPrivato.bind(null, c.id, c.stato === "attivo")}>
                          <button type="submit" className="btn btn-secondary btn-piccolo">{c.stato === "attivo" ? "Blocca" : "Sblocca"}</button>
                        </form>
                      </td>
                    )}
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
