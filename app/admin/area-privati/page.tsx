import Link from "next/link";
import { richiediAdmin } from "@/lib/auth";
import { creaClientServer } from "@/lib/supabase/server";
import { Attivazione, FormSpese } from "./ModuliAreaPrivati";

export const metadata = { title: "Area Privati" };

export default async function AreaPrivati() {
  await richiediAdmin();
  const db = await creaClientServer();
  const [{ data: spese }, { data: imp }, { data: motivo }, { count }] = await Promise.all([
    db.from("spese_spedizione").select("importo_cent, soglia_gratuita_cent, iva").eq("canale", "privati").maybeSingle(),
    db.from("impostazioni").select("area_privati_attiva, mesi_minimi_lotto_privati").single(),
    db.rpc("area_privati_attivabile"),
    db.from("privati").select("id", { count: "exact", head: true }),
  ]);
  const euro = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
  const attiva = Boolean(imp?.area_privati_attiva);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-magistra-blu">Area Privati<span className="filetto" aria-hidden="true" /></h1>
        <p className="mt-4 text-muted max-w-3xl">
          Il negozio per i clienti privati. In locale si può provare sempre; online si apre solo quando lo attivi, e l&apos;attivazione è possibile
          solo con le spese di spedizione impostate e le condizioni di vendita per i privati validate da un legale.
        </p>
        <p className="mt-2 text-sm">
          {count ?? 0} clienti registrati · <Link href="/admin/privati">Clienti</Link> · <Link href="/admin/sconti-privati">Sconti del mese</Link> ·{" "}
          <Link href="/admin/documenti">Condizioni di vendita privati</Link> · <Link href="/negozio">Vedi il negozio</Link>
        </p>
      </header>

      <section className="panel p-6 space-y-3" aria-labelledby="t-stato">
        <h2 id="t-stato" className="text-2xl text-magistra-blu">Attivazione online</h2>
        <p>
          Stato: {attiva ? <span className="pill pill-ok">Attiva</span> : <span className="pill pill-off">Non attiva</span>}
        </p>
        {!attiva && motivo && <p className="avviso avviso-attenzione">Per attivarla: {motivo}.</p>}
        <Attivazione attiva={attiva} />
      </section>

      <section className="panel p-6" aria-labelledby="t-spese">
        <h2 id="t-spese" className="text-2xl text-magistra-blu mb-4">Spese di spedizione e lotti</h2>
        <FormSpese
          iniziali={{
            importo: euro(spese?.importo_cent),
            soglia_gratuita: euro(spese?.soglia_gratuita_cent),
            iva: String(spese?.iva ?? 22).replace(".", ","),
            mesi_minimi_lotto_privati: String(imp?.mesi_minimi_lotto_privati ?? 6),
          }}
        />
      </section>
    </div>
  );
}
