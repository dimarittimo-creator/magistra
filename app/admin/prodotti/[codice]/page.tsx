import Link from "next/link";
import { notFound } from "next/navigation";
import { StoricoModifiche } from "@/components/admin/StoricoModifiche";
import { richiediAdmin } from "@/lib/auth";
import { formattaData } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";
import { FormProdotto } from "./FormProdotto";

export const metadata = { title: "Prodotto" };

const ETICHETTE: Record<string, string> = {
  nome: "Nome", formato: "Formato", descrizione: "Descrizione", linea_id: "Linea", area_id: "Area terapeutica",
  prezzo_pubblico_cent: "Prezzo al pubblico (centesimi)", iva_override: "IVA", minimo_ordine: "Ordine minimo", multiplo: "Multiplo",
  soglia_esaurimento: "Soglia in esaurimento", visibile_privati: "Visibile privati", attivo: "Attivo",
  descrizione_deposito: "Descrizione del deposito", codice_interno_deposito: "Codice interno del deposito",
};

export default async function PaginaProdotto({ params }: { params: Promise<{ codice: string }> }) {
  await richiediAdmin();
  const { codice } = await params;
  const db = await creaClientServer();
  const [{ data: p }, { data: linee }, { data: aree }, { data: imp }, { data: lotti }] = await Promise.all([
    db.from("prodotti").select("*, linea:linea_id(nome), area:area_id(nome)").eq("codice", codice).maybeSingle(),
    db.from("linee").select("id, nome").order("nome"),
    db.from("aree_terapeutiche").select("id, nome").order("nome"),
    db.from("impostazioni").select("iva_predefinita").single(),
    db.from("lotti").select("id, codice_lotto, scadenza, giacenza, deposito:deposito_id(nome)").eq("prodotto_codice", codice).gt("giacenza", 0).order("scadenza"),
  ]);
  if (!p) notFound();

  const iniziali = {
    nome: p.nome, formato: p.formato ?? "", descrizione: p.descrizione ?? "",
    linea: (p.linea as { nome: string } | null)?.nome ?? "", area: (p.area as { nome: string } | null)?.nome ?? "",
    prezzo: p.prezzo_pubblico_cent == null ? "" : (p.prezzo_pubblico_cent / 100).toFixed(2).replace(".", ","),
    iva: p.iva_override == null ? "" : String(p.iva_override).replace(".", ","),
    minimo_ordine: String(p.minimo_ordine), multiplo: String(p.multiplo),
    soglia_esaurimento: p.soglia_esaurimento == null ? "" : String(p.soglia_esaurimento),
    attivo: p.attivo ? "on" : "", visibile_privati: p.visibile_privati ? "on" : "",
  };

  return (
    <div className="space-y-6">
      <p><Link href="/admin/prodotti">← Prodotti</Link></p>
      <header>
        <h1 className="text-3xl text-magistra-blu">
          {p.nome}
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-3 text-muted">
          Minsan {p.codice}
          {p.descrizione_deposito && ` · nel file del deposito: ${p.descrizione_deposito}`}
          {p.codice_interno_deposito && ` · codice interno ${p.codice_interno_deposito} (non visibile alle farmacie)`}
        </p>
      </header>
      <section className="panel p-6">
        <FormProdotto codice={p.codice} iniziali={iniziali} linee={(linee ?? []).map((l) => l.nome)} aree={(aree ?? []).map((a) => a.nome)} ivaPredefinita={Number(imp?.iva_predefinita ?? 10)} />
      </section>
      <section className="panel p-6 overflow-x-auto" aria-labelledby="t-lotti">
        <h2 id="t-lotti" className="text-2xl text-magistra-blu mb-3">Lotti in giacenza</h2>
        {!lotti?.length ? (
          <p className="text-muted">Nessun lotto in giacenza.</p>
        ) : (
          <table className="tabella min-w-[480px]">
            <thead><tr><th>Lotto</th><th>Scadenza</th><th className="text-right">Giacenza</th><th>Deposito</th></tr></thead>
            <tbody>
              {lotti.map((l) => (
                <tr key={l.id}>
                  <td>{l.codice_lotto}</td>
                  <td>{l.scadenza ? formattaData(l.scadenza) : "—"}</td>
                  <td className="text-right">{l.giacenza.toLocaleString("it-IT")}</td>
                  <td>{(l.deposito as unknown as { nome: string } | null)?.nome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="aiuto mt-3">Sconti sui singoli lotti: <Link href="/admin/sconti">Sconti e prezzi</Link>.</p>
      </section>
      <StoricoModifiche
        tabella="prodotti"
        recordId={p.id}
        etichette={ETICHETTE}
        valoriLeggibili={{
          linea_id: Object.fromEntries((linee ?? []).map((l) => [l.id, l.nome])),
          area_id: Object.fromEntries((aree ?? []).map((a) => [a.id, a.nome])),
        }}
      />
    </div>
  );
}
