import Link from "next/link";
import { richiediStaff } from "@/lib/auth";
import { formattaData } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";

export const metadata = { title: "Cruscotto" };

export default async function Cruscotto() {
  const utente = await richiediStaff();
  const db = await creaClientServer();

  const conta = (stato: string) => db.from("farmacie").select("id", { count: "exact", head: true }).eq("stato", stato);
  const [attesa, attive, bloccate, { data: ultime }] = await Promise.all([
    conta("in_attesa"),
    conta("attiva"),
    conta("bloccata"),
    db
      .from("farmacie")
      .select("id, ragione_sociale, creato_il, indirizzi(citta, tipo)")
      .eq("stato", "in_attesa")
      .order("creato_il", { ascending: true })
      .limit(10),
  ]);

  const riquadri = [
    { testo: "Iscrizioni da approvare", valore: attesa.count ?? 0, href: "/admin/farmacie?stato=in_attesa", classe: "pill-warn" },
    { testo: "Farmacie attive", valore: attive.count ?? 0, href: "/admin/farmacie?stato=attiva", classe: "pill-ok" },
    { testo: "Farmacie bloccate", valore: bloccate.count ?? 0, href: "/admin/farmacie?stato=bloccata", classe: "pill-bad" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Buongiorno{utente.profilo.nome ? `, ${utente.profilo.nome}` : ""}
          <span className="filetto" aria-hidden="true" />
        </h1>
      </header>

      <ul className="grid gap-4 sm:grid-cols-3">
        {riquadri.map((r) => (
          <li key={r.testo}>
            <Link href={r.href} className="panel p-5 flex flex-col gap-2 no-underline text-ink hover:border-brand">
              <span className="text-sm text-muted">{r.testo}</span>
              <span className="text-4xl font-semibold tabular-nums">{r.valore}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="panel p-6" aria-labelledby="titolo-attesa">
        <h2 id="titolo-attesa" className="text-2xl text-magistra-blu">Iscrizioni in attesa</h2>
        {ultime && ultime.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="tabella min-w-[480px]">
              <thead>
                <tr>
                  <th>Farmacia</th>
                  <th>Città</th>
                  <th>Richiesta del</th>
                </tr>
              </thead>
              <tbody>
                {ultime.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <Link href={`/admin/farmacie/${f.id}`} className="font-semibold">
                        {f.ragione_sociale}
                      </Link>
                    </td>
                    <td>{(f.indirizzi as { citta: string; tipo: string }[]).find((i) => i.tipo === "consegna")?.citta ?? "—"}</td>
                    <td>{formattaData(f.creato_il)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-muted">Nessuna iscrizione da approvare.</p>
        )}
      </section>
    </div>
  );
}
