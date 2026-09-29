import { richiediAdmin } from "@/lib/auth";
import { formattaEuro } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";
import { rimuoviLimite } from "./azioni";
import { AggiungiLimite, FormModalita, ModificaModalita, type Modalita } from "./ModuliPagamenti";

export const metadata = { title: "Pagamenti" };

const CANALI = { farmacie: "Farmacie", privati: "Privati", entrambi: "Farmacie e privati" };

export default async function Pagamenti() {
  await richiediAdmin();
  const db = await creaClientServer();
  const [{ data: modalita }, { data: limiti }, { data: gruppi }, { data: farmacie }] = await Promise.all([
    db.from("modalita_pagamento").select("*").order("ordine"),
    db.from("modalita_pagamento_limiti").select("id, modalita_id, gruppo:gruppo_id(nome), farmacia:farmacia_id(ragione_sociale, codice_farmacia)"),
    db.from("gruppi").select("id, nome").eq("attivo", true).order("nome"),
    db.from("farmacie").select("id, ragione_sociale, codice_farmacia").eq("stato", "attiva").order("ragione_sociale"),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Modalità di pagamento
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted max-w-3xl">
          La modalità di pagamento è obbligatoria in ogni ordine. Una modalità senza limitazioni vale per tutti; se aggiungi limitazioni, la vedono
          solo i gruppi e le farmacie indicati (es. RIBA solo per i clienti storici).
        </p>
      </header>

      <ul className="space-y-4">
        {((modalita ?? []) as Modalita[]).map((m) => {
          const suoi = (limiti ?? []).filter((l) => l.modalita_id === m.id) as unknown as {
            id: string;
            gruppo: { nome: string } | null;
            farmacia: { ragione_sociale: string; codice_farmacia: string } | null;
          }[];
          return (
            <li key={m.id} className={`panel p-5 space-y-3 ${m.attiva ? "" : "opacity-70"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-sans font-semibold">
                    {m.descrizione} {!m.attiva && <span className="pill pill-off ml-2">Non attiva</span>}
                  </h2>
                  <p className="text-sm text-muted">
                    {CANALI[m.canale]}
                    {m.richiede_iban && " · bonifico con IBAN della società"}
                    {m.contrassegno && " · contrassegno"}
                    {m.costo_aggiuntivo_cent > 0 && ` · costo ${formattaEuro(m.costo_aggiuntivo_cent)}`}
                  </p>
                </div>
                <ModificaModalita modalita={m} />
              </div>
              {m.canale !== "privati" && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">
                    {suoi.length ? "Solo per:" : "Disponibile per tutte le farmacie"}
                  </p>
                  {suoi.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                      {suoi.map((l) => (
                        <li key={l.id} className="pill pill-ok flex items-center gap-2">
                          {l.gruppo ? `Gruppo ${l.gruppo.nome}` : `${l.farmacia?.ragione_sociale} (${l.farmacia?.codice_farmacia})`}
                          <form action={rimuoviLimite.bind(null, l.id)}>
                            <button type="submit" className="cursor-pointer" aria-label="Togli limitazione">×</button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                  <AggiungiLimite
                    modalitaId={m.id}
                    gruppi={gruppi ?? []}
                    farmacie={(farmacie ?? []).map((f) => ({ id: f.id, nome: `${f.ragione_sociale} (${f.codice_farmacia})` }))}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <section className="panel p-6" aria-labelledby="t-nuova">
        <h2 id="t-nuova" className="text-2xl text-magistra-blu mb-4">Nuova modalità</h2>
        <FormModalita />
      </section>
    </div>
  );
}
