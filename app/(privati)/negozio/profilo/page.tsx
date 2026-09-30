import { richiediPrivato } from "@/lib/auth";
import { creaClientServer } from "@/lib/supabase/server";
import { FormMarketingPrivato, FormPasswordPrivato, FormProfiloPrivato } from "./ModuliProfiloPrivato";

export const metadata = { title: "Il mio profilo" };

export default async function ProfiloPrivato() {
  const utente = await richiediPrivato();
  const db = await creaClientServer();
  const [{ data: p }, { data: indirizzi }, { data: marketing }] = await Promise.all([
    db.from("privati").select("nome, cognome, codice_fiscale, email, telefono").eq("id", utente.privatoId).single(),
    db.from("indirizzi").select("tipo, presso, indirizzo, cap, citta, provincia").eq("privato_id", utente.privatoId),
    db.from("consensi").select("accettato").eq("utente_id", utente.id).eq("tipo", "marketing").order("il", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const iniziali: Record<string, string> = { ...(p ?? {}) };
  for (const i of indirizzi ?? []) {
    for (const k of ["presso", "indirizzo", "cap", "citta", "provincia"] as const) iniziali[`${i.tipo}_${k}`] = i[k] ?? "";
  }
  const c = indirizzi?.find((i) => i.tipo === "consegna");
  const f = indirizzi?.find((i) => i.tipo === "fatturazione");
  iniziali.fatturazione_uguale = c && f && c.indirizzo === f.indirizzo && c.cap === f.cap && c.citta === f.citta ? "on" : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <h1 className="text-3xl text-magistra-blu">Il mio profilo<span className="filetto" aria-hidden="true" /></h1>
      <section className="panel p-6"><FormProfiloPrivato iniziali={iniziali} /></section>
      <section className="panel p-6 space-y-3">
        <h2 className="text-2xl text-magistra-blu">Accesso</h2>
        <p className="text-sm text-muted">Accedi con: <strong className="text-ink">{utente.email}</strong></p>
        <FormPasswordPrivato />
      </section>
      <section className="panel p-6 space-y-3">
        <h2 className="text-2xl text-magistra-blu">Comunicazioni</h2>
        <FormMarketingPrivato accettato={Boolean(marketing?.accettato)} />
      </section>
    </div>
  );
}
