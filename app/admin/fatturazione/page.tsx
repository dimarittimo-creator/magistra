import Link from "next/link";
import { richiediAdmin } from "@/lib/auth";
import { leggiDdt, valoreDistribuito, type Filtri } from "@/lib/fatturazione";
import { formattaData, formattaEuro } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";
import { segnaFatturati } from "./azioni";

export const metadata = { title: "Fatturazione" };

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const nomeMese = (m: string) => `${MESI[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

export default async function Fatturazione({ searchParams }: { searchParams: Promise<{ societa?: string; canale?: string; stato?: string }> }) {
  await richiediAdmin();
  const p = await searchParams;
  const stato = (["da_fatturare", "fatturati", "tutti"].includes(p.stato ?? "") ? p.stato : "da_fatturare") as Filtri["stato"];
  const db = await creaClientServer();
  const [{ data: societa }, { data: depositi }, ddt, tutti] = await Promise.all([
    db.from("societa").select("id, nome_breve").order("predefinita", { ascending: false }),
    db.from("sedi").select("id, nome, operatore:operatore_id(nome_breve, percentuale_compenso)").eq("tipo", "deposito"),
    leggiDdt(db, { societaId: p.societa || null, canale: p.canale || null, stato }),
    leggiDdt(db, { stato: "tutti" }),
  ]);
  const perDeposito = new Map((depositi ?? []).map((d) => [d.id as string, d as unknown as { nome: string; operatore: { nome_breve: string; percentuale_compenso: number } | null }]));
  const valori = valoreDistribuito(tutti).slice(0, 48);
  const link = (cambi: Record<string, string | undefined>) => {
    const q = new URLSearchParams({ ...(p.societa ? { societa: p.societa } : {}), ...(p.canale ? { canale: p.canale } : {}), stato: stato!, ...cambi } as Record<string, string>);
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    return `/admin/fatturazione?${q}`;
  };
  const totale = ddt.reduce((s, d) => s + d.totali.totaleCent, 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Fatturazione
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted max-w-3xl">
          Il portale non emette fatture: qui trovi i DDT da fatturare, separati per società, da esportare per il gestionale. Gli importi sono quelli
          delle quantità realmente spedite.
        </p>
      </header>

      <nav aria-label="Filtri" className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Link href={link({ societa: "" })} className={`btn btn-piccolo ${!p.societa ? "btn-primary" : "btn-secondary"}`} aria-current={!p.societa ? "page" : undefined}>Tutte le società</Link>
          {(societa ?? []).map((s) => (
            <Link key={s.id} href={link({ societa: s.id })} className={`btn btn-piccolo ${p.societa === s.id ? "btn-primary" : "btn-secondary"}`} aria-current={p.societa === s.id ? "page" : undefined}>{s.nome_breve}</Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {[["da_fatturare", "Da fatturare"], ["fatturati", "Già fatturati"], ["tutti", "Tutti"]].map(([v, t]) => (
            <Link key={v} href={link({ stato: v })} className={`btn btn-piccolo ${stato === v ? "btn-primary" : "btn-secondary"}`} aria-current={stato === v ? "page" : undefined}>{t}</Link>
          ))}
          {[["", "Tutti i canali"], ["farmacie", "Farmacie"], ["privati", "Privati"]].map(([v, t]) => (
            <Link key={v || "tutti"} href={link({ canale: v })} className={`btn btn-piccolo ${(p.canale ?? "") === v ? "btn-primary" : "btn-secondary"}`}>{t}</Link>
          ))}
        </div>
      </nav>

      <section className="panel p-4 sm:p-6 overflow-x-auto" aria-labelledby="t-ddt">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 id="t-ddt" className="text-2xl text-magistra-blu">DDT ({ddt.length}) · totale {formattaEuro(totale)}</h2>
          <a href={`/api/admin/fatturazione/export?${new URLSearchParams({ societa: p.societa ?? "", canale: p.canale ?? "", stato: stato! })}`} className="btn btn-secondary btn-piccolo">
            Esporta in Excel
          </a>
        </div>
        {ddt.length === 0 ? (
          <p className="text-muted">Nessun DDT con questi filtri.</p>
        ) : (
          <form action={segnaFatturati}>
            <table className="tabella min-w-[900px] text-sm">
              <thead>
                <tr><th><span className="sr-only">Seleziona</span></th><th>DDT</th><th>Ordine</th><th>Società</th><th>Cliente</th><th>Pagamento</th><th className="text-right">Imponibile</th><th className="text-right">IVA</th><th className="text-right">Totale</th><th>Stato</th></tr>
              </thead>
              <tbody>
                {ddt.map((d) => (
                  <tr key={d.spedizioneId}>
                    <td><input type="checkbox" name="ddt" value={d.spedizioneId} aria-label={`Seleziona DDT ${d.ddtNumero}`} className="size-5 accent-[var(--brand)]" /></td>
                    <td className="whitespace-nowrap">n. {d.ddtNumero}<div className="text-xs text-muted">{formattaData(d.ddtData)}</div></td>
                    <td><Link href={`/admin/ordini/${d.ordineId}`}>{d.numeroOrdine}</Link></td>
                    <td>{d.societa.nome_breve}</td>
                    <td>{d.cliente.ragione_sociale}<div className="text-xs text-muted">P.IVA {d.cliente.partita_iva}</div></td>
                    <td>{d.pagamento.descrizione}{d.scadenzeRiba.length > 0 && <div className="text-xs text-muted">scad. {d.scadenzeRiba.map(formattaData).join(", ")}</div>}</td>
                    <td className="text-right">{formattaEuro(d.totali.imponibileCent)}</td>
                    <td className="text-right">{formattaEuro(d.totali.ivaCent)}</td>
                    <td className="text-right font-semibold">{formattaEuro(d.totali.totaleCent)}</td>
                    <td>{d.fatturato ? <span className="pill pill-ok">Fatturato</span> : <span className="pill pill-warn">Da fatturare</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap gap-3 mt-4">
              <button type="submit" name="azione" value="fatturato" className="btn btn-primary btn-piccolo">Segna selezionati come fatturati</button>
              <button type="submit" name="azione" value="annulla" className="btn btn-secondary btn-piccolo">Togli il segno «fatturato»</button>
            </div>
          </form>
        )}
        <p className="aiuto mt-3">Scadenze RIBA stimate: data del DDT più i giorni della RIBA, a fine mese.</p>
      </section>

      <section className="panel p-4 sm:p-6 overflow-x-auto" aria-labelledby="t-valore">
        <h2 id="t-valore" className="text-2xl text-magistra-blu mb-1">Valore distribuito per mese</h2>
        <p className="text-sm text-muted mb-3">Imponibile dei DDT del mese, per deposito e società: serve a controllare la fattura mensile dell&apos;operatore logistico.</p>
        {valori.length === 0 ? (
          <p className="text-muted">Nessuna spedizione registrata.</p>
        ) : (
          <table className="tabella min-w-[640px] text-sm">
            <thead><tr><th>Mese</th><th>Deposito</th><th>Società</th><th className="text-right">DDT</th><th className="text-right">Imponibile distribuito</th><th className="text-right">Compenso operatore</th></tr></thead>
            <tbody>
              {valori.map((v) => {
                const dep = perDeposito.get(v.depositoId);
                const perc = dep?.operatore ? Number(dep.operatore.percentuale_compenso) : null;
                return (
                  <tr key={`${v.mese}${v.depositoId}${v.societaId}`}>
                    <td className="capitalize">{nomeMese(v.mese)}</td>
                    <td>{dep?.nome}</td>
                    <td>{v.societa}</td>
                    <td className="text-right">{v.ddt}</td>
                    <td className="text-right font-semibold">{formattaEuro(v.imponibileCent)}</td>
                    <td className="text-right">{perc != null ? `${formattaEuro(Math.round((v.imponibileCent * perc) / 100))} (${perc.toLocaleString("it-IT")}% ${dep?.operatore?.nome_breve})` : "—"}</td>
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
