import Link from "next/link";
import { richiediMedicoAttivo } from "@/lib/auth";
import { formattaData } from "@/lib/formato";
import { STATI_CAMPIONE, leggiSchede } from "@/lib/medici/contenuti";
import { creaClientServer } from "@/lib/supabase/server";
import { FormCampioni } from "./FormCampioni";

export const metadata = { title: "Campioni gratuiti" };

type Spedizione = { destinatario: string; struttura: string | null; presso: string | null; indirizzo: string; cap: string; citta: string; provincia: string };

export default async function Campioni({ searchParams }: { searchParams: Promise<{ prodotto?: string }> }) {
  const utente = await richiediMedicoAttivo();
  const { prodotto } = await searchParams;
  const db = await creaClientServer();
  const [schede, { data: imp }, { data: medico }, { data: richieste }] = await Promise.all([
    leggiSchede(),
    db.from("impostazioni").select("campioni_max_confezioni").single(),
    db.from("medici").select("struttura, presso, indirizzo, cap, citta, provincia").eq("id", utente.medicoId).single(),
    db
      .from("richieste_campioni")
      .select("id, prodotto_nome, quantita, note, stato, messaggio_admin, creato_il, spedizione")
      .eq("medico_id", utente.medicoId)
      .order("creato_il", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10 space-y-6">
      <h1 className="text-3xl text-magistra-blu">
        Campioni gratuiti
        <span className="filetto" aria-hidden="true" />
      </h1>

      <section className="panel p-6 sm:p-8" aria-labelledby="t-nuova">
        <h2 id="t-nuova" className="text-2xl text-magistra-blu">Nuova richiesta</h2>
        {medico && (
          <p className="mt-2 text-sm text-muted">
            Spediamo all&apos;indirizzo dello studio: {[medico.struttura, medico.presso, medico.indirizzo, `${medico.cap} ${medico.citta} (${medico.provincia})`].filter(Boolean).join(", ")}.{" "}
            <Link href="/medici/profilo">Modifica</Link>
          </p>
        )}
        <div className="mt-5">
          <FormCampioni prodotti={schede.map(({ codice, nome }) => ({ codice, nome }))} massimo={imp?.campioni_max_confezioni ?? 5} scelto={prodotto} />
        </div>
      </section>

      <section className="panel p-6 sm:p-8" aria-labelledby="t-richieste">
        <h2 id="t-richieste" className="text-2xl text-magistra-blu">Le mie richieste</h2>
        {richieste?.length ? (
          <ul className="mt-4 divide-y divide-line">
            {richieste.map((r) => {
              const s = STATI_CAMPIONE[r.stato];
              const sped = r.spedizione as Spedizione;
              return (
                <li key={r.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p>
                      <strong>{r.prodotto_nome}</strong> · {r.quantita} {r.quantita === 1 ? "confezione" : "confezioni"}
                    </p>
                    <span className={`pill ${s.classe}`}>{s.testo}</span>
                  </div>
                  <p className="text-sm text-muted">
                    Richiesta del {formattaData(r.creato_il)} · a {sped.citta}
                  </p>
                  {r.note && <p className="text-sm">Note: {r.note}</p>}
                  {r.messaggio_admin && <p className="text-sm mt-1">Messaggio di Magistra: {r.messaggio_admin}</p>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-muted">Non ha ancora inviato richieste.</p>
        )}
      </section>
    </div>
  );
}
