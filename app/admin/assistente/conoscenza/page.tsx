import Link from "next/link";
import { richiediAdmin } from "@/lib/auth";
import { embeddingAttivo } from "@/lib/chat/embedding";
import { formattaDataOra } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";
import { NavAssistente } from "../NavAssistente";
import { PUBBLICI_KB, STATI_KB, TIPI_KB } from "./etichette";

export const metadata = { title: "Assistente – base di conoscenza" };

export default async function BaseConoscenza() {
  await richiediAdmin();
  const db = await creaClientServer();
  const { data } = await db
    .from("kb_documenti")
    .select("id, titolo, tipo, pubblico, prodotto_codice, stato, versione, aggiornato_il, kb_frammenti(count)")
    .order("stato")
    .order("titolo");

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <h1 className="text-3xl text-magistra-blu">
          Base di conoscenza
          <span className="filetto" aria-hidden="true" />
        </h1>
        <NavAssistente attiva="/admin/assistente/conoscenza" admin />
        <div className="text-muted max-w-3xl space-y-2">
          <p>
            Schede prodotto, domande frequenti e materiale informativo che l&apos;assistente può usare. <strong>Usa solo documenti approvati</strong>: un testo
            nuovo o modificato resta in bozza finché un amministratore non lo approva. Inserisci solo testi coerenti con quanto notificato al Ministero della
            Salute e con i claim consentiti.
          </p>
          <p className="text-sm">
            Ricerca: {embeddingAttivo() ? "per parole e per significato (vettori pgvector)." : "per parole (ricerca testuale in italiano). La ricerca per significato si attiva collegando un servizio di embedding."}
          </p>
        </div>
        <Link href="/admin/assistente/conoscenza/nuovo" className="btn btn-primary">
          Nuovo documento
        </Link>
      </header>

      <section className="panel p-6">
        {(data ?? []).length === 0 ? (
          <p className="text-muted">Nessun documento caricato. Finché la base di conoscenza è vuota, l&apos;assistente risponde sui prodotti solo con i dati del catalogo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tabella">
              <thead>
                <tr>
                  <th>Titolo</th>
                  <th>Tipo</th>
                  <th>Destinatari</th>
                  <th>Prodotto</th>
                  <th>Stato</th>
                  <th>Versione</th>
                  <th>Aggiornato</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/admin/assistente/conoscenza/${d.id}`}>{d.titolo}</Link>
                    </td>
                    <td>{TIPI_KB[d.tipo]}</td>
                    <td>{PUBBLICI_KB[d.pubblico]}</td>
                    <td>{d.prodotto_codice ?? "—"}</td>
                    <td>
                      <span className={`pill ${STATI_KB[d.stato].classe}`}>{STATI_KB[d.stato].testo}</span>
                    </td>
                    <td>{d.versione}</td>
                    <td>{formattaDataOra(d.aggiornato_il)}</td>
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
