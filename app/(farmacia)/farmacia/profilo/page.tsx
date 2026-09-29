import { richiediFarmacia } from "@/lib/auth";
import { leggiFarmacia, valoriFarmacia } from "@/lib/farmacie/lettura";
import { creaClientServer } from "@/lib/supabase/server";
import { FormMarketing, FormPassword, FormProfilo } from "./ModuliProfilo";

export const metadata = { title: "Il mio profilo" };

export default async function Profilo() {
  const utente = await richiediFarmacia();
  const db = await creaClientServer();
  const [farmacia, { data: marketing }] = await Promise.all([
    leggiFarmacia(db, utente.profilo.farmacia_id!),
    db
      .from("consensi")
      .select("accettato")
      .eq("utente_id", utente.id)
      .eq("tipo", "marketing")
      .order("il", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!farmacia) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10 space-y-6">
      <h1 className="text-3xl text-magistra-blu">
        Il mio profilo
        <span className="filetto" aria-hidden="true" />
      </h1>

      <section className="panel p-6 sm:p-8">
        <FormProfilo valoriIniziali={valoriFarmacia(farmacia)} />
      </section>

      <section className="panel p-6 sm:p-8" aria-labelledby="titolo-accesso">
        <h2 id="titolo-accesso" className="text-2xl text-magistra-blu">Accesso</h2>
        <p className="mt-2 text-sm text-muted">
          Accedi con: <strong className="text-ink">{utente.email}</strong>
        </p>
        <div className="mt-5">
          <FormPassword />
        </div>
      </section>

      <section className="panel p-6 sm:p-8" aria-labelledby="titolo-comunicazioni">
        <h2 id="titolo-comunicazioni" className="text-2xl text-magistra-blu">Comunicazioni commerciali</h2>
        <div className="mt-5">
          <FormMarketing accettato={Boolean(marketing?.accettato)} />
        </div>
      </section>
    </div>
  );
}
