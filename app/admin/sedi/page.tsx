import Link from "next/link";
import { richiediAdmin } from "@/lib/auth";
import { TIPI_SEDE, type Sede } from "@/lib/sedi";
import { creaClientServer } from "@/lib/supabase/server";

export const metadata = { title: "Sedi e depositi" };

type Riga = Sede & { societa: { nome_breve: string } | null; operatore: { nome_breve: string } | null };

export default async function ElencoSedi() {
  await richiediAdmin();
  const db = await creaClientServer();
  const { data } = await db
    .from("sedi")
    .select("*, societa:societa_id(nome_breve), operatore:operatore_id(nome_breve)")
    .order("attiva", { ascending: false })
    .order("tipo", { ascending: false })
    .order("nome");
  const sedi = (data ?? []) as unknown as Riga[];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-magistra-blu">
            Sedi e depositi
            <span className="filetto" aria-hidden="true" />
          </h1>
          <p className="mt-4 text-muted max-w-3xl">
            La merce parte dai depositi; un deposito può spedire per entrambe le società. Le sedi non si cancellano: si
            disattivano.
          </p>
        </div>
        <Link href="/admin/sedi/nuova" className="btn btn-primary">
          Nuova sede
        </Link>
      </header>

      <div className="panel p-4 sm:p-6 overflow-x-auto">
        <table className="tabella min-w-[760px]">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Società</th>
              <th>Indirizzo</th>
              <th>Email</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {sedi.map((s) => (
              <tr key={s.id} className={s.attiva ? "" : "text-muted"}>
                <td>
                  <Link href={`/admin/sedi/${s.id}`} className="font-semibold">
                    {s.nome}
                  </Link>
                  {s.operatore && <div className="text-sm text-muted">Gestito da {s.operatore.nome_breve}</div>}
                </td>
                <td>
                  {TIPI_SEDE[s.tipo]}
                  {s.predefinito && <span className="pill pill-ok ml-2">Predefinito</span>}
                </td>
                <td>{s.societa?.nome_breve}</td>
                <td>
                  {s.indirizzo} – {s.cap} {s.citta} ({s.provincia})
                </td>
                <td>{s.email ?? "—"}</td>
                <td>{s.attiva ? <span className="pill pill-ok">Attiva</span> : <span className="pill pill-off">Disattivata</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
