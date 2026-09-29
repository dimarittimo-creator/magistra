import Link from "next/link";
import { richiediAdmin } from "@/lib/auth";
import { oggiRoma } from "@/lib/date";
import { formattaData, formattaDataOra } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";
import { FormImport } from "./FormImport";

export const metadata = { title: "Magazzino" };

const TIPI: Record<string, string> = { deposito_crystal: "Giacenza deposito", listino: "Listino", modello: "Modello Magistra" };
const STATI: Record<string, { testo: string; classe: string }> = {
  anteprima: { testo: "In anteprima", classe: "pill-warn" },
  applicato: { testo: "Applicato", classe: "pill-ok" },
  annullato: { testo: "Annullato", classe: "pill-off" },
};

export default async function Magazzino() {
  await richiediAdmin();
  const db = await creaClientServer();
  const [{ data: depositi }, { data: imports }] = await Promise.all([
    db.from("sedi").select("id, nome, predefinito").eq("tipo", "deposito").eq("attiva", true).order("predefinito", { ascending: false }),
    db.from("import_magazzino").select("id, tipo, file_nome, data_giacenza, stato, creato_il, deposito:deposito_id(nome)").order("creato_il", { ascending: false }).limit(30),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Magazzino
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted max-w-3xl">
          Carica la giacenza del deposito, il listino o il modello Magistra. Prima di applicare vedi un&apos;anteprima con gli
          errori e le differenze.
        </p>
      </header>

      <section className="panel p-6" aria-labelledby="titolo-carica">
        <h2 id="titolo-carica" className="text-2xl text-magistra-blu mb-4">Carica un file</h2>
        <FormImport depositi={depositi ?? []} oggi={oggiRoma()} />
      </section>

      <section className="panel p-6" aria-labelledby="titolo-scarica">
        <h2 id="titolo-scarica" className="text-2xl text-magistra-blu mb-2">Scarica</h2>
        <p className="text-muted mb-4">Il file del magazzino si può correggere e ricaricare come «Modello Magistra».</p>
        <div className="flex flex-wrap gap-3">
          <a href="/api/admin/magazzino/export" className="btn btn-secondary">Magazzino attuale (.xlsx)</a>
          <a href="/api/admin/magazzino/modello" className="btn btn-secondary">Modello vuoto con legenda (.xlsx)</a>
        </div>
      </section>

      <section className="panel p-6 overflow-x-auto" aria-labelledby="titolo-storico">
        <h2 id="titolo-storico" className="text-2xl text-magistra-blu mb-4">Ultimi import</h2>
        {!imports?.length ? (
          <p className="text-muted">Nessun import.</p>
        ) : (
          <table className="tabella min-w-[640px]">
            <thead>
              <tr><th>Data</th><th>Tipo</th><th>File</th><th>Deposito</th><th>Giacenza del</th><th>Stato</th></tr>
            </thead>
            <tbody>
              {imports.map((i) => (
                <tr key={i.id}>
                  <td className="whitespace-nowrap">{formattaDataOra(i.creato_il)}</td>
                  <td>{TIPI[i.tipo]}</td>
                  <td><Link href={`/admin/magazzino/import/${i.id}`}>{i.file_nome}</Link></td>
                  <td>{(i.deposito as unknown as { nome: string } | null)?.nome ?? "—"}</td>
                  <td>{i.data_giacenza ? formattaData(i.data_giacenza) : "—"}</td>
                  <td><span className={`pill ${STATI[i.stato].classe}`}>{STATI[i.stato].testo}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
