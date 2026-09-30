import Link from "next/link";
import { richiediAdmin } from "@/lib/auth";
import { creaClientServer } from "@/lib/supabase/server";
import { FormImpostazioni } from "./FormImpostazioni";

export const metadata = { title: "Impostazioni" };

export default async function Impostazioni() {
  await richiediAdmin();
  const db = await creaClientServer();
  const { data: i } = await db.from("impostazioni").select("*").single();
  const iniziali: Record<string, string> = {
    giorni_validita_prenotazione: String(i.giorni_validita_prenotazione),
    giorni_consegna_indicativi: String(i.giorni_consegna_indicativi),
    soglia_minima_ordine: i.soglia_minima_ordine_cent == null ? "" : (i.soglia_minima_ordine_cent / 100).toFixed(2).replace(".", ","),
    soglia_esaurimento_default: String(i.soglia_esaurimento_default),
    modalita_invio_deposito: i.modalita_invio_deposito,
    orario_invio_cumulativo: String(i.orario_invio_cumulativo).slice(0, 5),
    ore_sollecito_ddt: String(i.ore_sollecito_ddt),
    prezzi_in_richiesta_evasione: i.prezzi_in_richiesta_evasione ? "on" : "",
    email_notifiche_admin: (i.email_notifiche_admin ?? []).join(", "),
    mesi_non_vendibile: i.mesi_non_vendibile == null ? "" : String(i.mesi_non_vendibile),
    mesi_conservazione_chat: String(i.mesi_conservazione_chat),
  };
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Impostazioni
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted max-w-3xl">
          Regole generali del portale. Fasce di sconto e IVA predefinita sono in <Link href="/admin/sconti">Sconti e prezzi</Link>; testi legali in{" "}
          <Link href="/admin/documenti">Condizioni e privacy</Link>; modalità di pagamento in <Link href="/admin/pagamenti">Pagamenti</Link>.
        </p>
      </header>
      <section className="panel p-6">
        <FormImpostazioni iniziali={iniziali} />
      </section>
    </div>
  );
}
