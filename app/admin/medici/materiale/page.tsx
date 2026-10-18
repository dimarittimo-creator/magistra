import Link from "next/link";
import { richiediAdmin } from "@/lib/auth";
import { formattaData } from "@/lib/formato";
import { TIPI_MATERIALE, formattaDimensione } from "@/lib/medici/contenuti";
import { creaClientServer } from "@/lib/supabase/server";
import { AzioniMateriale, FormCaricaMateriale } from "./ModuliMateriale";

export const metadata = { title: "Materiale scientifico" };

export default async function AdminMateriale() {
  await richiediAdmin();
  const db = await creaClientServer();
  const [{ data: materiali }, { data: prodotti }] = await Promise.all([
    db.from("materiali_medici").select("id, titolo, descrizione, tipo, prodotto_codice, file_nome, dimensione_byte, pubblicato, creato_il").order("creato_il", { ascending: false }),
    db.from("prodotti").select("codice, nome").eq("attivo", true).order("nome"),
  ]);
  const nomi = new Map((prodotti ?? []).map((p) => [p.codice, p.nome]));

  return (
    <div className="space-y-6">
      <p>
        <Link href="/admin/medici">← Medici</Link>
      </p>
      <h1 className="text-3xl text-magistra-blu">
        Materiale scientifico
        <span className="filetto" aria-hidden="true" />
      </h1>
      <p className="text-muted">Documenti PDF per l&apos;area Medici. I medici approvati vedono e scaricano solo quelli pubblicati.</p>

      <section className="panel p-6" aria-labelledby="t-carica">
        <h2 id="t-carica" className="text-2xl text-magistra-blu mb-4">Carica un documento</h2>
        <FormCaricaMateriale prodotti={prodotti ?? []} />
      </section>

      <section className="panel p-4 sm:p-6 overflow-x-auto" aria-labelledby="t-elenco">
        <h2 id="t-elenco" className="text-2xl text-magistra-blu mb-4">Documenti</h2>
        {!materiali?.length ? (
          <p className="text-muted">Nessun documento caricato.</p>
        ) : (
          <table className="tabella min-w-[760px]">
            <thead>
              <tr><th>Titolo</th><th>Tipo</th><th>Prodotto</th><th>File</th><th>Stato</th><th>Caricato il</th><th>Azioni</th></tr>
            </thead>
            <tbody>
              {materiali.map((m) => (
                <tr key={m.id}>
                  <td>
                    <a href={`/api/materiali/${m.id}`} className="font-semibold">{m.titolo}</a>
                    {m.descrizione && <p className="text-xs text-muted">{m.descrizione}</p>}
                  </td>
                  <td>{TIPI_MATERIALE[m.tipo]}</td>
                  <td>{m.prodotto_codice ? nomi.get(m.prodotto_codice) ?? m.prodotto_codice : "—"}</td>
                  <td className="text-sm">{m.file_nome} · {formattaDimensione(m.dimensione_byte)}</td>
                  <td><span className={`pill ${m.pubblicato ? "pill-ok" : "pill-warn"}`}>{m.pubblicato ? "Pubblicato" : "Bozza"}</span></td>
                  <td>{formattaData(m.creato_il)}</td>
                  <td><AzioniMateriale id={m.id} pubblicato={m.pubblicato} titolo={m.titolo} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
