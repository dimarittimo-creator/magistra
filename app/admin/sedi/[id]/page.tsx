import Link from "next/link";
import { notFound } from "next/navigation";
import { StoricoModifiche } from "@/components/admin/StoricoModifiche";
import { richiediAdmin } from "@/lib/auth";
import { ETICHETTE_SEDE, TIPI_SEDE, type Sede } from "@/lib/sedi";
import { creaClientServer } from "@/lib/supabase/server";
import { FormSede } from "../FormSede";

export const metadata = { title: "Sede" };

// /admin/sedi/nuova crea una sede; /admin/sedi/<id> la modifica.
export default async function PaginaSede({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creata?: string }>;
}) {
  await richiediAdmin();
  const { id } = await params;
  const { creata } = await searchParams;
  const nuova = id === "nuova";
  const db = await creaClientServer();

  const [{ data: societa }, { data: operatori }, { data: sede }] = await Promise.all([
    db.from("societa").select("id, nome_breve").order("predefinita", { ascending: false }),
    db.from("operatori_logistici").select("id, ragione_sociale").eq("attivo", true).order("ragione_sociale"),
    nuova ? Promise.resolve({ data: null }) : db.from("sedi").select("*").eq("id", id).maybeSingle(),
  ]);
  if (!nuova && !sede) notFound();

  const s = sede as Sede | null;
  const iniziali: Record<string, string> = s
    ? {
        societa_id: s.societa_id,
        tipo: s.tipo,
        nome: s.nome,
        indirizzo: s.indirizzo,
        cap: s.cap ?? "",
        citta: s.citta ?? "",
        provincia: s.provincia ?? "",
        telefono: s.telefono ?? "",
        email: s.email ?? "",
        email_cc: s.email_cc.join(", "),
        referente: s.referente ?? "",
        orari: s.orari ?? "",
        predefinito: s.predefinito ? "on" : "",
        operatore_id: s.operatore_id ?? "",
        attiva: s.attiva ? "on" : "",
        note: s.note ?? "",
      }
    : { tipo: "deposito", societa_id: societa?.[0]?.id ?? "", attiva: "on" };

  const nomiSocieta = Object.fromEntries((societa ?? []).map((x) => [x.id, x.nome_breve]));
  const nomiOperatori = Object.fromEntries((operatori ?? []).map((x) => [x.id, x.ragione_sociale]));

  return (
    <div className="space-y-6">
      <p>
        <Link href="/admin/sedi">← Tutte le sedi</Link>
      </p>
      <h1 className="text-3xl text-magistra-blu">
        {s ? s.nome : "Nuova sede"}
        <span className="filetto" aria-hidden="true" />
      </h1>
      {creata && <p role="status" className="avviso avviso-ok">Sede creata.</p>}
      <section className="panel p-6 sm:p-8">
        <FormSede
          id={s?.id ?? null}
          iniziali={iniziali}
          societa={(societa ?? []).map((x) => ({ id: x.id, nome: x.nome_breve }))}
          operatori={(operatori ?? []).map((x) => ({ id: x.id, nome: x.ragione_sociale }))}
        />
      </section>
      {s && (
        <StoricoModifiche
          tabella="sedi"
          recordId={s.id}
          etichette={ETICHETTE_SEDE}
          valoriLeggibili={{ societa_id: nomiSocieta, operatore_id: nomiOperatori, tipo: TIPI_SEDE }}
        />
      )}
    </div>
  );
}
