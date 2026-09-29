import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  haDifformita,
  lottoVisibile,
  statoLotto,
  statoProdotto,
  type StatoLotto,
  type StatoProdotto,
} from "@/lib/availability";
import { oggiRoma, type DataISO } from "@/lib/date";
import { aliquotaProdotto, calcolaPrezzi, scontoPerLotto, type Fascia, type Prezzi, type ScontoLotto } from "@/lib/pricing";

// Catalogo per le farmacie: unisce dati del database, stati (lib/availability)
// e prezzi (lib/pricing). Usato da catalogo, scheda prodotto, carrello e invio ordine.

export type Impostazioni = {
  iva_predefinita: number;
  giorni_validita_prenotazione: number;
  giorni_consegna_indicativi: number;
  soglia_minima_ordine_cent: number | null;
  soglia_esaurimento_default: number;
  mesi_non_vendibile: number | null;
};

export type LottoCatalogo = {
  id: string;
  codice_lotto: string;
  scadenza: DataISO | null;
  deposito_id: string;
  disponibile: number;
  stato: StatoLotto;
  sconto: ScontoLotto | null;
  prezzi: Prezzi | null;
};

export type ProdottoCatalogo = {
  codice: string;
  nome: string;
  formato: string | null;
  descrizione: string | null;
  linea: { id: string; nome: string } | null;
  area: { id: string; nome: string } | null;
  immagine_path: string | null;
  iva: number;
  prezzo_pubblico_cent: number | null;
  minimo_ordine: number;
  multiplo: number;
  stato: StatoProdotto;
  disponibile: number;
  lotti: LottoCatalogo[];
  /** Miglior prezzo farmacia IVA esclusa tra i lotti vendibili. */
  prezzoMigliore: Prezzi | null;
};

export type Catalogo = { oggi: DataISO; impostazioni: Impostazioni; fasce: Fascia[]; prodotti: ProdottoCatalogo[] };

type RigaProdotto = {
  codice: string;
  nome: string;
  formato: string | null;
  descrizione: string | null;
  immagine_path: string | null;
  prezzo_pubblico_cent: number | null;
  iva_override: number | null;
  minimo_ordine: number;
  multiplo: number;
  soglia_esaurimento: number | null;
  attivo: boolean;
  linea: { id: string; nome: string } | null;
  area: { id: string; nome: string } | null;
};

type RigaLotto = {
  id: string;
  prodotto_codice: string;
  deposito_id: string;
  codice_lotto: string;
  scadenza: string | null;
  giacenza: number;
  sconto_manuale: number | null;
};

/**
 * Carica il catalogo (tutto, o un solo prodotto) con il client dell'utente: la RLS
 * lo rende leggibile solo a farmacie attive e staff. Con `includiNonVisibili` (staff)
 * restano anche i prodotti senza prezzo.
 */
export async function caricaCatalogo(
  db: SupabaseClient,
  opzioni: { codice?: string; oggi?: DataISO; includiNonVisibili?: boolean } = {},
): Promise<Catalogo> {
  const oggi = opzioni.oggi ?? oggiRoma();
  let qProdotti = db
    .from("prodotti")
    .select("codice, nome, formato, descrizione, immagine_path, prezzo_pubblico_cent, iva_override, minimo_ordine, multiplo, soglia_esaurimento, attivo, linea:linea_id(id, nome), area:area_id(id, nome)")
    .order("nome");
  let qLotti = db.from("lotti").select("id, prodotto_codice, deposito_id, codice_lotto, scadenza, giacenza, sconto_manuale");
  let qGiacenze = db.from("giacenze_prodotto").select("prodotto_codice, deposito_id, totale_dichiarato");
  if (opzioni.codice) {
    qProdotti = qProdotti.eq("codice", opzioni.codice);
    qLotti = qLotti.eq("prodotto_codice", opzioni.codice);
    qGiacenze = qGiacenze.eq("prodotto_codice", opzioni.codice);
  }

  const [imp, fasce, prodotti, lotti, giacenze, disp] = await Promise.all([
    db.from("impostazioni").select("iva_predefinita, giorni_validita_prenotazione, giorni_consegna_indicativi, soglia_minima_ordine_cent, soglia_esaurimento_default, mesi_non_vendibile").single(),
    db.from("fasce_sconto").select("mesi_minimi, sconto_percentuale").eq("attiva", true),
    qProdotti,
    qLotti,
    qGiacenze,
    db.rpc("disponibilita_lotti", opzioni.codice ? { p_prodotto: opzioni.codice } : {}),
  ]);
  for (const r of [imp, fasce, prodotti, lotti, giacenze, disp]) if (r.error) throw new Error(r.error.message);

  const impostazioni = {
    ...(imp.data as Impostazioni),
    iva_predefinita: Number(imp.data!.iva_predefinita),
  };
  const fasceNum: Fascia[] = (fasce.data ?? []).map((f) => ({ mesi_minimi: f.mesi_minimi, sconto_percentuale: Number(f.sconto_percentuale) }));
  const disponibile = new Map(((disp.data ?? []) as { lotto_id: string; disponibile: number }[]).map((d) => [d.lotto_id, d.disponibile]));
  const lottiPerProdotto = Map.groupBy((lotti.data ?? []) as RigaLotto[], (l) => l.prodotto_codice);
  const giacenzePerProdotto = Map.groupBy(
    (giacenze.data ?? []) as { prodotto_codice: string; deposito_id: string; totale_dichiarato: number }[],
    (g) => g.prodotto_codice,
  );

  const risultato: ProdottoCatalogo[] = [];
  for (const p of (prodotti.data ?? []) as unknown as RigaProdotto[]) {
    const iva = aliquotaProdotto(p.iva_override == null ? null : Number(p.iva_override), impostazioni.iva_predefinita);
    const righeLotti = (lottiPerProdotto.get(p.codice) ?? []).filter((l) => l.giacenza > 0);
    const base = righeLotti.map((l) => ({ ...l, disponibile: disponibile.get(l.id) ?? l.giacenza }));
    const difforme = haDifformita(
      (lottiPerProdotto.get(p.codice) ?? []).map((l) => ({ ...l, disponibile: 0 })),
      giacenzePerProdotto.get(p.codice) ?? [],
    );

    const lottiCatalogo: LottoCatalogo[] = base.map((l) => {
      const stato = statoLotto(l, {
        oggi,
        difforme,
        conPrezzo: p.prezzo_pubblico_cent != null,
        mesiNonVendibile: impostazioni.mesi_non_vendibile,
      });
      const sconto =
        stato === "vendibile" || stato === "esaurito"
          ? scontoPerLotto({ scadenza: l.scadenza!, oggi, fasce: fasceNum, scontoManuale: l.sconto_manuale == null ? null : Number(l.sconto_manuale) })
          : null;
      return {
        id: l.id,
        codice_lotto: l.codice_lotto,
        scadenza: l.scadenza,
        deposito_id: l.deposito_id,
        disponibile: Math.max(l.disponibile, 0),
        stato,
        sconto,
        prezzi: sconto && p.prezzo_pubblico_cent != null ? calcolaPrezzi(p.prezzo_pubblico_cent, iva, sconto.sconto) : null,
      };
    });

    const { stato, disponibile: totale } = statoProdotto(p, lottiCatalogo.map((l, i) => ({ ...base[i], stato: l.stato })), {
      difforme,
      sogliaEsaurimentoPredefinita: impostazioni.soglia_esaurimento_default,
    });
    if (stato === "non_visibile" && !opzioni.includiNonVisibili) continue;

    const visibili = lottiCatalogo.filter((l) => lottoVisibile(l.stato)).sort((a, b) => (a.scadenza ?? "9999").localeCompare(b.scadenza ?? "9999"));
    const vendibili = visibili.filter((l) => l.stato === "vendibile" && l.prezzi);
    const prezzoMigliore = vendibili.reduce<Prezzi | null>(
      (m, l) => (!m || l.prezzi!.farmaciaNettoCent < m.farmaciaNettoCent ? l.prezzi : m),
      null,
    );

    risultato.push({
      codice: p.codice,
      nome: p.nome,
      formato: p.formato,
      descrizione: p.descrizione,
      linea: p.linea,
      area: p.area,
      immagine_path: p.immagine_path,
      iva,
      prezzo_pubblico_cent: p.prezzo_pubblico_cent,
      minimo_ordine: p.minimo_ordine,
      multiplo: p.multiplo,
      stato,
      disponibile: totale,
      lotti: visibili,
      prezzoMigliore,
    });
  }

  return { oggi, impostazioni, fasce: fasceNum, prodotti: risultato };
}
