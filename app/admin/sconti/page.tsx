import { haDifformita } from "@/lib/availability";
import { richiediAdmin } from "@/lib/auth";
import { oggiRoma } from "@/lib/date";
import { creaClientServer } from "@/lib/supabase/server";
import { PannelloSconti, type ProdottoPannello } from "./PannelloSconti";

export const metadata = { title: "Sconti e prezzi" };

export default async function Sconti() {
  await richiediAdmin();
  const db = await creaClientServer();
  const [{ data: prodotti }, { data: lotti }, { data: giacenze }, { data: fasce }, { data: imp }, { data: sedi }] = await Promise.all([
    db.from("prodotti").select("codice, nome, prezzo_pubblico_cent, iva_override").eq("attivo", true).order("nome"),
    db.from("lotti").select("id, prodotto_codice, deposito_id, codice_lotto, scadenza, giacenza, sconto_manuale").order("scadenza"),
    db.from("giacenze_prodotto").select("prodotto_codice, deposito_id, totale_dichiarato"),
    db.from("fasce_sconto").select("mesi_minimi, sconto_percentuale").eq("attiva", true),
    db.from("impostazioni").select("iva_predefinita").single(),
    db.from("sedi").select("id, nome"),
  ]);
  const nomeSede = new Map((sedi ?? []).map((s) => [s.id as string, s.nome as string]));

  const dati: ProdottoPannello[] = (prodotti ?? [])
    .map((p) => {
      const tutti = (lotti ?? []).filter((l) => l.prodotto_codice === p.codice);
      const difforme = haDifformita(
        tutti.map((l) => ({ deposito_id: l.deposito_id, scadenza: l.scadenza, giacenza: l.giacenza, disponibile: 0 })),
        (giacenze ?? []).filter((g) => g.prodotto_codice === p.codice),
      );
      return {
        codice: p.codice,
        nome: p.nome,
        prezzo_pubblico_cent: p.prezzo_pubblico_cent,
        iva_override: p.iva_override == null ? null : Number(p.iva_override),
        difforme,
        lotti: tutti
          .filter((l) => l.giacenza > 0)
          .map((l) => ({
            id: l.id,
            codice_lotto: l.codice_lotto,
            scadenza: l.scadenza,
            giacenza: l.giacenza,
            sconto_manuale: l.sconto_manuale == null ? null : Number(l.sconto_manuale),
            deposito: nomeSede.get(l.deposito_id) ?? "",
          })),
      };
    })
    .filter((p) => p.lotti.length > 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl text-magistra-blu">
          Sconti e prezzi farmacia
          <span className="filetto" aria-hidden="true" />
        </h1>
        <p className="mt-4 text-muted max-w-3xl">
          Modifica le fasce di sconto, l&apos;IVA e le eccezioni: i prezzi farmacia di ogni lotto si aggiornano subito. Con «Salva modifiche» le
          nuove impostazioni valgono per tutte le farmacie.
        </p>
      </header>
      <PannelloSconti
        prodotti={dati}
        fasce={(fasce ?? []).map((f) => ({ mesi_minimi: f.mesi_minimi, sconto_percentuale: Number(f.sconto_percentuale) }))}
        iva={Number(imp?.iva_predefinita ?? 10)}
        oggi={oggiRoma()}
      />
    </div>
  );
}
