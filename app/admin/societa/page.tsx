import Link from "next/link";
import { richiediAdmin } from "@/lib/auth";
import type { Societa } from "@/lib/societa";
import { creaClientServer } from "@/lib/supabase/server";
import { formattaIban, ibanValido } from "@/lib/validazione";

export const metadata = { title: "Società" };

export default async function ElencoSocieta() {
  await richiediAdmin();
  const db = await creaClientServer();
  const { data } = await db.from("societa").select("*").order("predefinita", { ascending: false }).order("nome_breve");
  const societa = (data ?? []) as Societa[];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Società
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted max-w-3xl">
          Le società che fatturano e consegnano. Ogni modifica resta nello storico; gli ordini già inviati conservano i
          dati del momento dell&apos;invio.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {societa.map((s) => (
          <article key={s.id} className="panel p-6 flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl text-magistra-blu">{s.nome_breve}</h2>
              {s.predefinita && <span className="pill pill-ok">Predefinita</span>}
              {!s.attiva && <span className="pill pill-off">Non attiva</span>}
            </div>
            <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm flex-1">
              <dt className="text-muted">Ragione sociale</dt><dd>{s.ragione_sociale}</dd>
              <dt className="text-muted">Sede legale</dt>
              <dd>{s.sede_legale_indirizzo} – {s.sede_legale_cap} {s.sede_legale_citta} ({s.sede_legale_provincia})</dd>
              <dt className="text-muted">P.IVA</dt><dd>{s.partita_iva}</dd>
              <dt className="text-muted">PEC</dt><dd>{s.pec ?? "—"}</dd>
              <dt className="text-muted">IBAN</dt>
              <dd>
                {s.iban ? (
                  <>
                    {formattaIban(s.iban)}{" "}
                    {!ibanValido(s.iban) && <span className="pill pill-bad">Non valido</span>}
                  </>
                ) : (
                  <span className="pill pill-warn">Mancante</span>
                )}
              </dd>
              <dt className="text-muted">Canali</dt>
              <dd>
                {[s.attiva_farmacie && "Farmacie", s.attiva_privati && "Privati"].filter(Boolean).join(" · ") || "nessuno"}
              </dd>
            </dl>
            <Link href={`/admin/societa/${s.id}`} className="btn btn-secondary mt-5 self-start">
              Modifica
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
