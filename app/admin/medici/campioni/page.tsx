import Link from "next/link";
import { richiediStaff } from "@/lib/auth";
import { formattaData } from "@/lib/formato";
import { STATI_CAMPIONE } from "@/lib/medici/contenuti";
import { creaClientServer } from "@/lib/supabase/server";
import { FormEsitoCampioni } from "./ModuliCampioni";

export const metadata = { title: "Richieste campioni" };

const FILTRI = [
  { valore: "da_gestire", testo: "Da gestire" },
  { valore: "spedita", testo: "Spedite" },
  { valore: "non_accolta", testo: "Non accolte" },
  { valore: "tutte", testo: "Tutte" },
];

type Spedizione = { destinatario: string; struttura: string | null; presso: string | null; indirizzo: string; cap: string; citta: string; provincia: string };

export default async function AdminCampioni({ searchParams }: { searchParams: Promise<{ stato?: string }> }) {
  await richiediStaff();
  const { stato } = await searchParams;
  const filtro = FILTRI.find((f) => f.valore === stato)?.valore ?? "da_gestire";
  const db = await creaClientServer();
  let q = db
    .from("richieste_campioni")
    .select("id, prodotto_nome, prodotto_codice, quantita, note, spedizione, stato, messaggio_admin, creato_il, medico:medico_id(id, nome, cognome, specializzazione, telefono)")
    .order("creato_il", { ascending: filtro === "da_gestire" })
    .limit(200);
  if (filtro === "da_gestire") q = q.in("stato", ["nuova", "in_lavorazione"]);
  else if (filtro !== "tutte") q = q.eq("stato", filtro);
  const { data: richieste, error } = await q;

  return (
    <div className="space-y-6">
      <p>
        <Link href="/admin/medici">← Medici</Link>
      </p>
      <h1 className="text-3xl text-magistra-blu">
        Richieste di campioni
        <span className="filetto" aria-hidden="true" />
      </h1>
      <nav aria-label="Filtra per stato" className="flex flex-wrap gap-2">
        {FILTRI.map((f) => (
          <Link key={f.valore} href={`/admin/medici/campioni?stato=${f.valore}`} aria-current={f.valore === filtro ? "page" : undefined}
            className={`btn btn-piccolo ${f.valore === filtro ? "btn-primary" : "btn-secondary"}`}>
            {f.testo}
          </Link>
        ))}
      </nav>
      {error && <p className="avviso avviso-errore">Errore nel caricamento: {error.message}</p>}
      {!richieste?.length ? (
        <p className="panel p-6 text-muted">Nessuna richiesta.</p>
      ) : (
        <ul className="space-y-4">
          {richieste.map((r) => {
            const medico = r.medico as unknown as { id: string; nome: string; cognome: string; specializzazione: string; telefono: string } | null;
            const s = r.spedizione as Spedizione;
            const etichetta = STATI_CAMPIONE[r.stato];
            return (
              <li key={r.id} className="panel p-5 space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-lg">
                    <strong>{r.prodotto_nome}</strong> × {r.quantita}
                  </p>
                  <span className={`pill ${etichetta.classe}`}>{r.stato === "nuova" ? "Nuova" : etichetta.testo}</span>
                </div>
                <p className="text-sm">
                  {medico ? <Link href={`/admin/medici/${medico.id}`}>Dott. {medico.nome} {medico.cognome}</Link> : "—"}
                  {medico ? ` · ${medico.specializzazione} · tel. ${medico.telefono}` : ""} · richiesta del {formattaData(r.creato_il)}
                </p>
                <p className="text-sm text-muted">
                  Spedire a: {[s.destinatario, s.struttura, s.presso, s.indirizzo, `${s.cap} ${s.citta} (${s.provincia})`].filter(Boolean).join(", ")}
                </p>
                {r.note && <p className="text-sm">Note del medico: {r.note}</p>}
                {r.messaggio_admin && <p className="text-sm">Ultimo messaggio al medico: {r.messaggio_admin}</p>}
                {(r.stato === "nuova" || r.stato === "in_lavorazione") && <FormEsitoCampioni id={r.id} stato={r.stato} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
