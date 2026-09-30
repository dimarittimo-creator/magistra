import { creaClientAdmin } from "@/lib/supabase/admin";

export const metadata = { title: "Chi siamo – dati del venditore" };

// Dati del venditore richiesti dal Codice del Consumo (docs/CONFORMITA.md): entrambe le società del gruppo.
export default async function ChiSiamo() {
  const { data: societa } = await creaClientAdmin()
    .from("societa")
    .select("ragione_sociale, nome_breve, sede_legale_indirizzo, sede_legale_cap, sede_legale_citta, sede_legale_provincia, partita_iva, codice_fiscale, rea, capitale_sociale_testo, pec, email, telefono, sito")
    .eq("attiva", true)
    .order("predefinita", { ascending: false });
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      <h1 className="text-3xl text-magistra-blu">Chi siamo – dati del venditore<span className="filetto" aria-hidden="true" /></h1>
      <p className="text-muted max-w-3xl">
        Magistra è il portale di vendita del gruppo Sagè Pharma · Bioeleva. In ogni ordine è indicata la società che vende, fattura e spedisce.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        {(societa ?? []).map((s) => (
          <section key={s.partita_iva} className="panel p-6 space-y-1 text-sm">
            <h2 className="text-2xl text-magistra-blu mb-2">{s.nome_breve}</h2>
            <p className="font-semibold">{s.ragione_sociale}</p>
            <p>Sede legale: {s.sede_legale_indirizzo} – {s.sede_legale_cap} {s.sede_legale_citta} ({s.sede_legale_provincia})</p>
            <p>P.IVA {s.partita_iva} · C.F. {s.codice_fiscale}</p>
            {s.rea && <p>REA {s.rea}</p>}
            {s.capitale_sociale_testo && <p>Capitale sociale {s.capitale_sociale_testo}</p>}
            {s.pec && <p>PEC {s.pec}</p>}
            {s.email && <p>Email {s.email}</p>}
            {s.telefono && <p>Telefono {s.telefono}</p>}
            {s.sito && <p>{s.sito}</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
