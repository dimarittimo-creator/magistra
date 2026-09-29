import Link from "next/link";
import { richiediStaff } from "@/lib/auth";
import { aggiungiGiorni, aggiungiMesi, oggiRoma } from "@/lib/date";
import { formattaData, formattaEuro } from "@/lib/formato";
import { STATI_APERTI } from "@/lib/ordini/stati";
import { creaClientServer } from "@/lib/supabase/server";

export const metadata = { title: "Cruscotto" };

const PERIODI = [
  { giorni: 7, testo: "7 giorni" },
  { giorni: 30, testo: "30 giorni" },
  { giorni: 90, testo: "3 mesi" },
  { giorni: 365, testo: "12 mesi" },
];

type OrdinePeriodo = {
  id: string;
  stato: string;
  totale_cent: number;
  imponibile_cent: number;
  farmacia_id: string | null;
  snapshot_cliente: { ragione_sociale: string };
  righe: { prodotto_codice: string; prodotto_nome: string; quantita: number; imponibile_cent: number }[];
};

export default async function Cruscotto({ searchParams }: { searchParams: Promise<{ giorni?: string; societa?: string; canale?: string }> }) {
  const utente = await richiediStaff();
  const p = await searchParams;
  const giorni = PERIODI.find((x) => String(x.giorni) === p.giorni)?.giorni ?? 30;
  const oggi = oggiRoma();
  const dal = aggiungiGiorni(oggi, -giorni);
  const db = await creaClientServer();

  let qOrdini = db
    .from("ordini")
    .select("id, stato, totale_cent, imponibile_cent, farmacia_id, snapshot_cliente, righe:righe_ordine(prodotto_codice, prodotto_nome, quantita, imponibile_cent)")
    .gte("creato_il", dal)
    .not("stato", "in", "(rifiutato,scaduto)");
  if (p.societa) qOrdini = qOrdini.eq("societa_id", p.societa);
  if (p.canale === "farmacie" || p.canale === "privati") qOrdini = qOrdini.eq("canale", p.canale);

  const [{ data: societa }, { data: ordini }, attesa, daConfermare, senzaDdt, { data: inScadenza }] = await Promise.all([
    db.from("societa").select("id, nome_breve").order("predefinita", { ascending: false }),
    qOrdini,
    db.from("farmacie").select("id", { count: "exact", head: true }).eq("stato", "in_attesa"),
    db.from("ordini").select("id", { count: "exact", head: true }).in("stato", ["inviato", "in_verifica"]),
    db.from("ordini").select("id", { count: "exact", head: true }).in("stato", ["inviato_deposito", "in_preparazione"]),
    db
      .from("lotti")
      .select("id, codice_lotto, scadenza, giacenza, prodotto:prodotto_codice(codice, nome)")
      .gt("giacenza", 0)
      .gte("scadenza", oggi)
      .lte("scadenza", aggiungiMesi(oggi, 6))
      .order("scadenza")
      .limit(10),
  ]);
  const periodo = (ordini ?? []) as unknown as OrdinePeriodo[];

  const perProdotto = new Map<string, { nome: string; pezzi: number; valore: number }>();
  const perFarmacia = new Map<string, { nome: string; ordini: number; valore: number }>();
  for (const o of periodo) {
    for (const r of o.righe) {
      const v = perProdotto.get(r.prodotto_codice) ?? { nome: r.prodotto_nome.replace(/ \(omaggio\)$/, ""), pezzi: 0, valore: 0 };
      v.pezzi += r.quantita;
      v.valore += r.imponibile_cent;
      perProdotto.set(r.prodotto_codice, v);
    }
    if (o.farmacia_id) {
      const f = perFarmacia.get(o.farmacia_id) ?? { nome: o.snapshot_cliente.ragione_sociale, ordini: 0, valore: 0 };
      f.ordini += 1;
      f.valore += o.imponibile_cent;
      perFarmacia.set(o.farmacia_id, f);
    }
  }
  const topProdotti = [...perProdotto.entries()].sort((a, b) => b[1].pezzi - a[1].pezzi).slice(0, 8);
  const topFarmacie = [...perFarmacia.entries()].sort((a, b) => b[1].valore - a[1].valore).slice(0, 8);
  const aperti = periodo.filter((o) => STATI_APERTI.includes(o.stato as never)).length;

  const link = (cambi: Record<string, string>) => {
    const q = new URLSearchParams({ giorni: String(giorni), ...(p.societa ? { societa: p.societa } : {}), ...(p.canale ? { canale: p.canale } : {}), ...cambi });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    return `/admin?${q}`;
  };

  const daFare = [
    { testo: "Iscrizioni da approvare", valore: attesa.count ?? 0, href: "/admin/farmacie?stato=in_attesa" },
    { testo: "Prenotazioni da confermare", valore: daConfermare.count ?? 0, href: "/admin/ordini?stato=inviato" },
    { testo: "Ordini al deposito senza DDT", valore: senzaDdt.count ?? 0, href: "/admin/ordini?stato=inviato_deposito" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Buongiorno{utente.profilo.nome ? `, ${utente.profilo.nome}` : ""}
          <span className="filetto" aria-hidden="true" />
        </h1>
      </header>

      <section aria-labelledby="t-da-fare">
        <h2 id="t-da-fare" className="sr-only">Da fare</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {daFare.map((r) => (
            <li key={r.testo}>
              <Link href={r.href} className={`panel p-5 flex flex-col gap-2 no-underline text-ink hover:border-brand ${r.valore ? "border-amber" : ""}`}>
                <span className="text-sm text-muted">{r.testo}</span>
                <span className="text-4xl font-semibold tabular-nums">{r.valore}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <nav aria-label="Filtri del cruscotto" className="flex flex-wrap gap-2">
        {PERIODI.map((x) => (
          <Link key={x.giorni} href={link({ giorni: String(x.giorni) })} className={`btn btn-piccolo ${giorni === x.giorni ? "btn-primary" : "btn-secondary"}`} aria-current={giorni === x.giorni ? "page" : undefined}>
            Ultimi {x.testo}
          </Link>
        ))}
        <span className="w-px bg-line mx-1" aria-hidden="true" />
        <Link href={link({ societa: "" })} className={`btn btn-piccolo ${!p.societa ? "btn-primary" : "btn-secondary"}`}>Tutte le società</Link>
        {(societa ?? []).map((s) => (
          <Link key={s.id} href={link({ societa: s.id })} className={`btn btn-piccolo ${p.societa === s.id ? "btn-primary" : "btn-secondary"}`}>{s.nome_breve}</Link>
        ))}
        <span className="w-px bg-line mx-1" aria-hidden="true" />
        {[["", "Tutti i canali"], ["farmacie", "Farmacie"], ["privati", "Privati"]].map(([v, t]) => (
          <Link key={v || "tutti"} href={link({ canale: v })} className={`btn btn-piccolo ${(p.canale ?? "") === v ? "btn-primary" : "btn-secondary"}`}>{t}</Link>
        ))}
      </nav>

      <ul className="grid gap-4 sm:grid-cols-3">
        <li className="panel p-5"><p className="text-sm text-muted">Ordini dal {formattaData(dal)}</p><p className="text-3xl font-semibold">{periodo.length}</p><p className="text-sm text-muted">{aperti} ancora aperti</p></li>
        <li className="panel p-5"><p className="text-sm text-muted">Imponibile ordinato</p><p className="text-3xl font-semibold">{formattaEuro(periodo.reduce((s, o) => s + o.imponibile_cent, 0))}</p></li>
        <li className="panel p-5"><p className="text-sm text-muted">Farmacie che hanno ordinato</p><p className="text-3xl font-semibold">{perFarmacia.size}</p></li>
      </ul>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-5 overflow-x-auto" aria-labelledby="t-prodotti">
          <h2 id="t-prodotti" className="text-2xl text-magistra-blu mb-3">Prodotti più richiesti</h2>
          {topProdotti.length === 0 ? <p className="text-muted">Nessun ordine nel periodo.</p> : (
            <table className="tabella text-sm">
              <thead><tr><th>Prodotto</th><th className="text-right">Pezzi</th><th className="text-right">Imponibile</th></tr></thead>
              <tbody>{topProdotti.map(([c, v]) => <tr key={c}><td>{v.nome}</td><td className="text-right">{v.pezzi.toLocaleString("it-IT")}</td><td className="text-right">{formattaEuro(v.valore)}</td></tr>)}</tbody>
            </table>
          )}
        </section>
        <section className="panel p-5 overflow-x-auto" aria-labelledby="t-farmacie">
          <h2 id="t-farmacie" className="text-2xl text-magistra-blu mb-3">Farmacie più attive</h2>
          {topFarmacie.length === 0 ? <p className="text-muted">Nessun ordine nel periodo.</p> : (
            <table className="tabella text-sm">
              <thead><tr><th>Farmacia</th><th className="text-right">Ordini</th><th className="text-right">Imponibile</th></tr></thead>
              <tbody>{topFarmacie.map(([id, f]) => <tr key={id}><td><Link href={`/admin/farmacie/${id}`}>{f.nome}</Link></td><td className="text-right">{f.ordini}</td><td className="text-right">{formattaEuro(f.valore)}</td></tr>)}</tbody>
            </table>
          )}
        </section>
      </div>

      <section className="panel p-5 overflow-x-auto" aria-labelledby="t-scadenza">
        <h2 id="t-scadenza" className="text-2xl text-magistra-blu mb-3">Lotti in scadenza nei prossimi 6 mesi</h2>
        {!inScadenza?.length ? <p className="text-muted">Nessun lotto in scadenza.</p> : (
          <table className="tabella text-sm min-w-[480px]">
            <thead><tr><th>Prodotto</th><th>Lotto</th><th>Scadenza</th><th className="text-right">Giacenza</th></tr></thead>
            <tbody>
              {inScadenza.map((l) => {
                const prod = l.prodotto as unknown as { codice: string; nome: string };
                return (
                  <tr key={l.id}>
                    <td><Link href={`/admin/prodotti/${prod.codice}`}>{prod.nome}</Link></td>
                    <td>{l.codice_lotto}</td>
                    <td>{formattaData(l.scadenza!)}</td>
                    <td className="text-right">{l.giacenza.toLocaleString("it-IT")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <p className="aiuto mt-2">Per spingerli: uno sconto sul lotto in <Link href="/admin/sconti">Sconti e prezzi</Link> o una <Link href="/admin/promozioni/nuova">promozione</Link>.</p>
      </section>
    </div>
  );
}
