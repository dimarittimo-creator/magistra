import { richiediAdmin } from "@/lib/auth";
import { aggiungiMesi, oggiRoma } from "@/lib/date";
import { formattaData } from "@/lib/formato";
import { primoDelMese, ultimoDelMese, type ScontoPrivati } from "@/lib/sconti-privati";
import { creaClientServer } from "@/lib/supabase/server";
import { AzioneSconto, NuovoSconto } from "./ModuliScontiPrivati";

export const metadata = { title: "Sconti privati del mese" };

export default async function ScontiPrivati() {
  await richiediAdmin();
  const db = await creaClientServer();
  const oggi = oggiRoma();
  const [{ data: sconti }, { data: prodotti }, { data: linee }, { data: imp }] = await Promise.all([
    db.from("sconti_privati").select("*, linea:linea_id(nome), prodotto:prodotto_codice(nome)").gte("fine", aggiungiMesi(primoDelMese(oggi), -3)).order("inizio", { ascending: false }),
    db.from("prodotti").select("codice, nome, linea_id, prezzo_pubblico_cent, iva_override").eq("attivo", true).eq("visibile_privati", true).not("prezzo_pubblico_cent", "is", null).order("nome"),
    db.from("linee").select("id, nome").order("nome"),
    db.from("impostazioni").select("iva_predefinita").single(),
  ]);
  const elenco = (sconti ?? []) as (ScontoPrivati & { linea: { nome: string } | null; prodotto: { nome: string } | null })[];
  const stato = (s: ScontoPrivati) => (s.fine < oggi ? "scaduto" : s.inizio > oggi ? "programmato" : "in corso");
  const inCorso = elenco.filter((s) => stato(s) === "in corso");
  const prossimoInizio = aggiungiMesi(primoDelMese(oggi), 1);
  const prossimoCoperto = elenco.some((s) => s.inizio <= ultimoDelMese(prossimoInizio) && s.fine >= prossimoInizio);
  const su = (s: (typeof elenco)[number]) => (s.ambito === "catalogo" ? "Tutto il negozio" : s.ambito === "linea" ? `Linea ${s.linea?.nome}` : s.prodotto?.nome);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-magistra-blu">Sconti privati del mese<span className="filetto" aria-hidden="true" /></h1>
        <p className="mt-4 text-muted max-w-3xl">
          Sconti sul prezzo al pubblico IVA inclusa per i clienti privati. Se più sconti valgono per lo stesso prodotto vale il migliore, mai la somma.
          A fine periodo scadono da soli. Cinque giorni prima della fine del mese ricevi un promemoria se il mese dopo non ha sconti.
        </p>
      </header>

      {!prossimoCoperto && (
        <div className="avviso avviso-attenzione flex flex-wrap items-center justify-between gap-3">
          <span>Il mese prossimo non ha ancora sconti.</span>
          {inCorso.length > 0 && <AzioneSconto ids={inCorso.map((s) => s.id)} tipo="copia" testo="Copia gli sconti di questo mese sul prossimo" />}
        </div>
      )}

      <section className="panel p-4 sm:p-6 overflow-x-auto" aria-labelledby="t-elenco">
        <h2 id="t-elenco" className="text-2xl text-magistra-blu mb-3">Sconti</h2>
        {elenco.length === 0 ? (
          <p className="text-muted">Nessuno sconto negli ultimi mesi.</p>
        ) : (
          <table className="tabella text-sm min-w-[720px]">
            <thead><tr><th>Su</th><th className="text-right">Sconto</th><th>Periodo</th><th>Stato</th><th /></tr></thead>
            <tbody>
              {elenco.map((s) => (
                <tr key={s.id} className={stato(s) === "scaduto" ? "text-muted" : ""}>
                  <td>{su(s)}</td>
                  <td className="text-right font-semibold">{Number(s.sconto_percentuale).toLocaleString("it-IT")}%</td>
                  <td className="whitespace-nowrap">{formattaData(s.inizio)} – {formattaData(s.fine)}</td>
                  <td>
                    <span className={`pill ${stato(s) === "in corso" ? "pill-ok" : stato(s) === "programmato" ? "pill-warn" : "pill-off"}`}>
                      {stato(s) === "in corso" ? "In corso" : stato(s) === "programmato" ? "Programmato" : "Scaduto"}
                    </span>
                  </td>
                  <td className="flex flex-wrap gap-2">
                    <AzioneSconto ids={[s.id]} tipo="copia" testo="Copia sul mese successivo" />
                    {stato(s) !== "scaduto" && <AzioneSconto ids={[s.id]} tipo="termina" testo={stato(s) === "programmato" ? "Elimina" : "Termina"} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel p-6" aria-labelledby="t-nuovo">
        <h2 id="t-nuovo" className="text-2xl text-magistra-blu mb-4">Nuovo sconto</h2>
        <NuovoSconto
          prodotti={(prodotti ?? []).map((p) => ({ codice: p.codice, nome: p.nome, lineaId: p.linea_id, pieno: p.prezzo_pubblico_cent!, iva: Number(p.iva_override ?? imp?.iva_predefinita ?? 10) }))}
          linee={linee ?? []}
          esistenti={elenco.map((s) => ({ ...s, sconto_percentuale: Number(s.sconto_percentuale) }))}
          periodo={{ inizio: primoDelMese(oggi), fine: ultimoDelMese(oggi) }}
        />
      </section>
    </div>
  );
}
