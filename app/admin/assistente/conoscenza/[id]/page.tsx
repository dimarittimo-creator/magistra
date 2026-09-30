import Link from "next/link";
import { notFound } from "next/navigation";
import { richiediAdmin } from "@/lib/auth";
import { formattaDataOra } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";
import { cambiaStatoDocumento, eliminaDocumento } from "../../azioni";
import { ModuloDocumento } from "../ModuloDocumento";
import { PUBBLICI_KB, STATI_KB, TIPI_KB } from "../etichette";

export const metadata = { title: "Documento della base di conoscenza" };

export default async function DocumentoKb({ params }: { params: Promise<{ id: string }> }) {
  await richiediAdmin();
  const { id } = await params;
  const nuovo = id === "nuovo";
  const db = await creaClientServer();
  const { data: doc } = nuovo
    ? { data: null }
    : await db
        .from("kb_documenti")
        .select("id, titolo, tipo, pubblico, prodotto_codice, testo, file_nome, stato, versione, creato_il, aggiornato_il, approvato_il, approvato_da, kb_frammenti(count)")
        .eq("id", id)
        .maybeSingle();
  if (!nuovo && !doc) notFound();
  const frammenti = (doc?.kb_frammenti as unknown as { count: number }[] | undefined)?.[0]?.count ?? 0;
  const approvatore = doc?.approvato_da
    ? ((await db.from("profili_utente").select("email").eq("id", doc.approvato_da).maybeSingle()).data?.email as string | undefined)
    : undefined;

  return (
    <div className="space-y-6">
      <p>
        <Link href="/admin/assistente/conoscenza">← Base di conoscenza</Link>
      </p>
      <header>
        <h1 className="text-3xl text-magistra-blu">
          {doc ? doc.titolo : "Nuovo documento"}
          <span className="filetto" aria-hidden="true" />
        </h1>
        {doc && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className={`pill ${STATI_KB[doc.stato].classe}`}>{STATI_KB[doc.stato].testo}</span>
            <span className="text-muted">
              Versione {doc.versione} · aggiornato il {formattaDataOra(doc.aggiornato_il)} · {frammenti} paragrafi indicizzati
              {doc.file_nome ? ` · dal file ${doc.file_nome}` : ""}
              {doc.approvato_il ? ` · approvato il ${formattaDataOra(doc.approvato_il)}${approvatore ? ` da ${approvatore}` : ""}` : ""}
            </span>
          </p>
        )}
      </header>

      {doc && (
        <section className="panel p-6 space-y-3" aria-labelledby="t-approvazione">
          <h2 id="t-approvazione" className="text-2xl text-magistra-blu">
            Approvazione
          </h2>
          {doc.stato === "approvato" ? (
            <p>L&apos;assistente usa questo testo. Se lo modifichi torna in bozza e va riapprovato.</p>
          ) : (
            <p>
              L&apos;assistente <strong>non</strong> usa questo testo finché non viene approvato. Approva solo dopo averlo verificato: le informazioni sui
              prodotti devono essere quelle validate dal gruppo.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {doc.stato !== "approvato" && (
              <form action={cambiaStatoDocumento.bind(null, doc.id, "approvato")}>
                <button type="submit" className="btn btn-primary">
                  Approva e rendi disponibile all&apos;assistente
                </button>
              </form>
            )}
            {doc.stato !== "archiviato" && (
              <form action={cambiaStatoDocumento.bind(null, doc.id, "archiviato")}>
                <button type="submit" className="btn btn-secondary">
                  Archivia (non più usato)
                </button>
              </form>
            )}
            {doc.stato !== "approvato" && (
              <form action={eliminaDocumento.bind(null, doc.id)}>
                <button type="submit" className="btn btn-secondary">
                  Elimina
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      <section className="panel p-6">
        <ModuloDocumento documento={doc} tipi={TIPI_KB} pubblici={PUBBLICI_KB} />
      </section>
    </div>
  );
}
