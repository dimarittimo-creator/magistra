import Link from "next/link";
import { notFound } from "next/navigation";
import { StoricoModifiche } from "@/components/admin/StoricoModifiche";
import { richiediAdmin } from "@/lib/auth";
import { ETICHETTE_SOCIETA, type Societa } from "@/lib/societa";
import { creaClientServer } from "@/lib/supabase/server";
import { formattaIban } from "@/lib/validazione";
import { FormSocieta } from "./FormSocieta";

export const metadata = { title: "Modifica società" };

export default async function ModificaSocieta({ params }: { params: Promise<{ id: string }> }) {
  await richiediAdmin();
  const { id } = await params;
  const db = await creaClientServer();
  const { data } = await db.from("societa").select("*").eq("id", id).maybeSingle();
  const s = data as Societa | null;
  if (!s) notFound();

  const iniziali: Record<string, string> = {};
  for (const [k, v] of Object.entries(s)) {
    if (typeof v === "boolean") iniziali[k] = v ? "on" : "";
    else iniziali[k] = v == null ? "" : String(v);
  }
  if (s.iban) iniziali.iban = formattaIban(s.iban);

  return (
    <div className="space-y-6">
      <p>
        <Link href="/admin/societa">← Tutte le società</Link>
      </p>
      <h1 className="text-3xl text-magistra-blu">
        {s.nome_breve}
        <span className="filetto" aria-hidden="true" />
      </h1>
      <section className="panel p-6 sm:p-8">
        <FormSocieta id={s.id} iniziali={iniziali} />
      </section>
      <StoricoModifiche tabella="societa" recordId={s.id} etichette={ETICHETTE_SOCIETA} />
    </div>
  );
}
