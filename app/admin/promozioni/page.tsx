import Link from "next/link";
import { richiediAdmin } from "@/lib/auth";
import { aggiungiGiorni, aggiungiMesi, oggiRoma } from "@/lib/date";
import { formattaData } from "@/lib/formato";
import { descriviPromozione, statoPromozione, type Promozione, type StatoPromozione } from "@/lib/promozioni";
import { creaClientServer } from "@/lib/supabase/server";
import { duplicaPromozione } from "./azioni";

export const metadata = { title: "Promozioni" };

const STATI: Record<StatoPromozione, { testo: string; classe: string; barra: string }> = {
  attiva: { testo: "Attiva", classe: "pill-ok", barra: "bg-slate" },
  programmata: { testo: "Programmata", classe: "pill-warn", barra: "bg-amber" },
  conclusa: { testo: "Conclusa", classe: "pill-off", barra: "bg-muted" },
  sospesa: { testo: "Sospesa", classe: "pill-off", barra: "bg-line" },
};
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

export default async function Promozioni() {
  await richiediAdmin();
  const db = await creaClientServer();
  const oggi = oggiRoma();
  const { data } = await db.from("promozioni").select("*, gruppo:gruppo_id(nome), prodotto:prodotto_codice(nome), linea:linea_id(nome)").order("inizio", { ascending: false });
  const promo = (data ?? []) as (Promozione & { gruppo: { nome: string } | null; prodotto: { nome: string } | null; linea: { nome: string } | null })[];

  // Calendario: dal primo del mese scorso per 4 mesi
  const inizio = `${aggiungiMesi(oggi, -1).slice(0, 7)}-01`;
  const fine = aggiungiMesi(inizio, 4);
  const giorni = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
  const totale = giorni(inizio, fine);
  const pos = (d: string) => Math.min(Math.max(giorni(inizio, d) / totale, 0), 1) * 100;
  const nelCalendario = promo.filter((p) => p.fine >= inizio && p.inizio < fine);
  const mesi = [0, 1, 2, 3].map((i) => aggiungiMesi(inizio, i));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl text-magistra-blu">
            Promozioni
            <span className="filetto" aria-hidden="true" />
          </h1>
          <p className="mt-4 text-muted max-w-3xl">
            Si attivano e si chiudono da sole tra le date indicate. Uno sconto % vale se è migliore dello sconto del lotto (non si sommano); sconto
            merce e omaggi si aggiungono e impegnano giacenza.
          </p>
        </div>
        <Link href="/admin/promozioni/nuova" className="btn btn-primary">Nuova promozione</Link>
      </header>

      <section className="panel p-4 sm:p-6 overflow-x-auto" aria-labelledby="t-cal">
        <h2 id="t-cal" className="text-2xl text-magistra-blu mb-4">Calendario</h2>
        <div className="min-w-[640px]">
          <div className="relative grid grid-cols-4 text-sm text-muted border-b border-line pb-1 ml-48">
            {mesi.map((m) => <span key={m} className="capitalize">{MESI[Number(m.slice(5, 7)) - 1]} {m.slice(0, 4)}</span>)}
          </div>
          <ul className="mt-2 space-y-2">
            {nelCalendario.length === 0 && <li className="text-muted">Nessuna promozione in questo periodo.</li>}
            {nelCalendario.map((p) => {
              const s = statoPromozione(p, oggi);
              return (
                <li key={p.id} className="flex items-center gap-2">
                  <Link href={`/admin/promozioni/${p.id}`} className="w-46 shrink-0 truncate text-sm">{p.nome}</Link>
                  <div className="relative h-5 flex-1 rounded bg-grey-soft">
                    <span className="absolute top-0 bottom-0 w-px bg-danger" style={{ left: `${pos(oggi)}%` }} aria-hidden="true" />
                    <span
                      className={`absolute top-0.5 bottom-0.5 rounded ${STATI[s].barra}`}
                      style={{ left: `${pos(p.inizio)}%`, width: `${Math.max(pos(aggiungiGiorni(p.fine, 1)) - pos(p.inizio), 1)}%` }}
                      title={`${formattaData(p.inizio)} – ${formattaData(p.fine)}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="aiuto mt-2 ml-48">La linea rossa è oggi.</p>
        </div>
      </section>

      <section className="panel p-4 sm:p-6 overflow-x-auto" aria-labelledby="t-elenco">
        <h2 id="t-elenco" className="text-2xl text-magistra-blu mb-3">Tutte le promozioni</h2>
        {promo.length === 0 ? (
          <p className="text-muted">Nessuna promozione.</p>
        ) : (
          <table className="tabella min-w-[760px] text-sm">
            <thead><tr><th>Nome</th><th>Cosa</th><th>Su</th><th>Farmacie</th><th>Periodo</th><th>Stato</th><th /></tr></thead>
            <tbody>
              {promo.map((p) => {
                const s = statoPromozione(p, oggi);
                const su = p.ambito === "catalogo" ? "Tutto il catalogo" : p.ambito === "linea" ? `Linea ${p.linea?.nome}` : p.ambito === "prodotto" ? p.prodotto?.nome : "Un lotto";
                return (
                  <tr key={p.id}>
                    <td><Link href={`/admin/promozioni/${p.id}`} className="font-semibold">{p.nome}</Link></td>
                    <td>{descriviPromozione(p)}</td>
                    <td>{su}</td>
                    <td>{p.gruppo?.nome ?? "Tutte"}</td>
                    <td className="whitespace-nowrap">{formattaData(p.inizio)} – {formattaData(p.fine)}</td>
                    <td><span className={`pill ${STATI[s].classe}`}>{STATI[s].testo}</span></td>
                    <td>
                      <form action={duplicaPromozione.bind(null, p.id)}>
                        <button type="submit" className="btn btn-secondary btn-piccolo">Duplica</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
