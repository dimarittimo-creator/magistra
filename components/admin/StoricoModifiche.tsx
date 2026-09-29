import { formattaDataOra } from "@/lib/formato";
import { creaClientServer } from "@/lib/supabase/server";

// Storico delle modifiche di un record (tabella storico_modifiche, scritta dai trigger del database).
// Mostra solo i campi cambiati, con le etichette in italiano.

const CAMPI_IGNORATI = new Set(["id", "creato_il", "aggiornato_il", "approvata_da"]);

export async function StoricoModifiche({
  tabella,
  recordId,
  etichette,
  valoriLeggibili = {},
}: {
  tabella: string;
  recordId: string;
  etichette: Record<string, string>;
  /** Traduzioni di valori tecnici, per campo (es. id di un gruppo → nome). */
  valoriLeggibili?: Record<string, Record<string, string>>;
}) {
  const db = await creaClientServer();
  const { data: righe } = await db
    .from("storico_modifiche")
    .select("id, prima, dopo, utente, il")
    .eq("tabella", tabella)
    .eq("record_id", recordId)
    .order("il", { ascending: false })
    .limit(50);

  const idUtenti = [...new Set((righe ?? []).map((r) => r.utente).filter(Boolean))] as string[];
  const { data: utenti } = idUtenti.length
    ? await db.from("profili_utente").select("id, nome, email").in("id", idUtenti)
    : { data: [] as { id: string; nome: string | null; email: string | null }[] };
  const nomeUtente = new Map((utenti ?? []).map((u) => [u.id, u.nome || u.email || "—"]));

  const voci = (righe ?? [])
    .map((r) => ({
      ...r,
      cambi: Object.keys({ ...(r.prima ?? {}), ...(r.dopo ?? {}) })
        .filter((k) => !CAMPI_IGNORATI.has(k) && JSON.stringify(r.prima?.[k]) !== JSON.stringify(r.dopo?.[k]))
        .map((k) => ({ campo: k, prima: r.prima?.[k], dopo: r.dopo?.[k] })),
    }))
    .filter((r) => r.cambi.length);

  const leggibile = (campo: string, valore: unknown): string => {
    if (valore === null || valore === undefined || valore === "") return "—";
    if (typeof valore === "boolean") return valore ? "sì" : "no";
    if (Array.isArray(valore)) return valore.length ? valore.join(", ") : "—";
    const s = String(valore);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return formattaDataOra(s);
    return valoriLeggibili[campo]?.[s] ?? s;
  };

  return (
    <section className="panel p-6" aria-labelledby={`storico-${recordId}`}>
      <h2 id={`storico-${recordId}`} className="text-2xl text-magistra-blu">
        Storico delle modifiche
      </h2>
      {voci.length === 0 ? (
        <p className="mt-3 text-muted">Nessuna modifica registrata.</p>
      ) : (
        <ol className="mt-4 space-y-4">
          {voci.map((v) => (
            <li key={v.id} className="border-l-2 border-magistra-rame pl-4">
              <p className="text-sm text-muted">
                {formattaDataOra(v.il)} · {v.utente ? nomeUtente.get(v.utente) ?? "utente" : "sistema"}
              </p>
              <ul className="mt-1 text-sm space-y-0.5">
                {v.cambi.map((c) => (
                  <li key={c.campo}>
                    <span className="font-semibold">{etichette[c.campo] ?? c.campo}:</span>{" "}
                    <span className="line-through text-muted">{leggibile(c.campo, c.prima)}</span> →{" "}
                    <span>{leggibile(c.campo, c.dopo)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
