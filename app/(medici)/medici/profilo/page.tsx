import { richiediMedico } from "@/lib/auth";
import { valoriMedico } from "@/lib/medici/dati";
import { creaClientServer } from "@/lib/supabase/server";
import { FormMarketingMedico, FormPasswordMedico, FormProfiloMedico } from "./ModuliProfiloMedico";

export const metadata = { title: "Il mio profilo" };

export default async function ProfiloMedico() {
  const utente = await richiediMedico();
  const db = await creaClientServer();
  const [{ data: medico }, { data: marketing }] = await Promise.all([
    db.from("medici").select("*").eq("id", utente.medicoId).maybeSingle(),
    db.from("consensi").select("accettato").eq("utente_id", utente.id).eq("tipo", "marketing").order("il", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!medico) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10 space-y-6">
      <h1 className="text-3xl text-magistra-blu">
        Il mio profilo
        <span className="filetto" aria-hidden="true" />
      </h1>
      <section className="panel p-6 sm:p-8">
        <FormProfiloMedico valoriIniziali={valoriMedico(medico)} />
      </section>
      <section className="panel p-6 sm:p-8" aria-labelledby="titolo-accesso">
        <h2 id="titolo-accesso" className="text-2xl text-magistra-blu">Accesso</h2>
        <p className="mt-2 text-sm text-muted">
          Accede con: <strong className="text-ink">{utente.email}</strong>
        </p>
        <div className="mt-5">
          <FormPasswordMedico />
        </div>
      </section>
      <section className="panel p-6 sm:p-8" aria-labelledby="titolo-comunicazioni">
        <h2 id="titolo-comunicazioni" className="text-2xl text-magistra-blu">Comunicazioni</h2>
        <div className="mt-5">
          <FormMarketingMedico accettato={Boolean(marketing?.accettato)} />
        </div>
      </section>
    </div>
  );
}
