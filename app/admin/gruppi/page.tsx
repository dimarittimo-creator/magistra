import { richiediAdmin } from "@/lib/auth";
import { creaClientServer } from "@/lib/supabase/server";
import { NuovoGruppo, RigaGruppo } from "./ModuliGruppi";

export const metadata = { title: "Gruppi di farmacie" };

export default async function Gruppi() {
  await richiediAdmin();
  const db = await creaClientServer();
  const { data } = await db.from("gruppi").select("id, nome, descrizione, attivo, farmacie(count)").order("attivo", { ascending: false }).order("nome");
  const gruppi = (data ?? []).map((g) => ({
    ...g,
    farmacie: (g.farmacie as unknown as { count: number }[])[0]?.count ?? 0,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Gruppi di farmacie
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted max-w-3xl">
          Raggruppa le farmacie (per esempio clienti storici o catene) per assegnare in seguito listini dedicati,
          promozioni e modalità di pagamento. Un gruppo non si cancella: si disattiva.
        </p>
      </header>

      <section className="panel p-6" aria-labelledby="titolo-nuovo">
        <h2 id="titolo-nuovo" className="text-2xl text-magistra-blu mb-4">Nuovo gruppo</h2>
        <NuovoGruppo />
      </section>

      <section className="panel p-6" aria-labelledby="titolo-elenco">
        <h2 id="titolo-elenco" className="text-2xl text-magistra-blu">Gruppi esistenti</h2>
        {gruppi.length === 0 ? (
          <p className="mt-3 text-muted">Nessun gruppo creato.</p>
        ) : (
          <ul className="mt-2">
            {gruppi.map((g) => (
              <RigaGruppo key={g.id} gruppo={g} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
