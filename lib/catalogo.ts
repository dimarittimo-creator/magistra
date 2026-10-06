import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  haDifformita,
  lottoVisibile,
  statoLotto,
  statoProdotto,
  sottoDurataGarantita,
  type StatoLotto,
  type StatoProdotto,
} from "@/lib/availability";
import { oggiRoma, type DataISO } from "@/lib/date";
import { aliquotaProdotto, calcolaPrezzi, scontoPerLotto, type Fascia, type Prezzi, type ScontoLotto } from "@/lib/pricing";
import { migliorScontoPromo, promoExtra, promoMerce, promozioneSiApplica, statoPromozione, type PromoExtra, type Promozione } from "@/lib/promozioni";

// Catalogo per le farmacie: unisce dati del database, stati (lib/availability), prezzi (lib/pricing),
// listino del gruppo della farmacia e promozioni attive (lib/promozioni).
// Usato da catalogo, scheda prodotto, carrello, invio ordine e area admin.

export type Impostazioni = {
  iva_predefinita: number;
  giorni_validita_prenotazione: number;
  giorni_consegna_indicativi: number;
  soglia_minima_ordine_cent: number | null;
  soglia_esaurimento_default: number;
  mesi_non_vendibile: number | null;
  mesi_durata_residua_garantita: number;
};

export type PromoMerce = Pick<Promozione, "id" | "nome" | "tipo" | "compra" | "omaggio_quantita" | "omaggio_prodotto_codice">;

export type LottoCatalogo = {
  id: string;
  codice_lotto: string;
  scadenza: DataISO | null;
  deposito_id: string;
  disponibile: number;
  stato: StatoLotto;
  sconto: ScontoLotto | null;
  prezzi: Prezzi | null;
  /** Sconto merce e omaggi validi per questo lotto */
  promoMerce: PromoMerce[];
  /** Omaggi extra non a magazzino (es. espositore) delle promozioni valide per questo lotto */
  promoExtra: PromoExtra[];
  /** Durata residua inferiore a quella garantita dalle condizioni di vendita: richiede accettazione espressa */
  durataRidotta: boolean;
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
  /** Prezzo al pubblico che vale per questa farmacia (listino del gruppo se c'è) */
  prezzo_pubblico_cent: number | null;
  prezzoDiGruppo: boolean;
  visibile_privati: boolean;
  minimo_ordine: number;
  multiplo: number;
  stato: StatoProdotto;
  disponibile: number;
  lotti: LottoCatalogo[];
  /** Miglior prezzo farmacia IVA esclusa tra i lotti vendibili. */
  prezzoMigliore: Prezzi | null;
};

/** Offerta in corso con volantino, per la pagina iniziale e le schede prodotto. */
export type OffertaConVolantino = { id: string; nome: string; immagine_path: string; fine: DataISO; prodotti: string[] };

export type Catalogo = { oggi: DataISO; impostazioni: Impostazioni; fasce: Fascia[]; prodotti: ProdottoCatalogo[]; offerte: OffertaConVolantino[] };

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
  visibile_privati: boolean;
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
 * lo rende leggibile solo a farmacie attive e staff. Con `farmaciaId` si applicano
 * listino del gruppo e promozioni riservate; con `includiNonVisibili` (staff)
 * restano anche i prodotti senza prezzo.
 */
export async function caricaCatalogo(
  db: SupabaseClient,
  opzioni: { codice?: string; oggi?: DataISO; includiNonVisibili?: boolean; farmaciaId?: string } = {},
): Promise<Catalogo> {
  const oggi = opzioni.oggi ?? oggiRoma();
  let qProdotti = db
    .from("prodotti")
    .select("codice, nome, formato, descrizione, immagine_path, prezzo_pubblico_cent, iva_override, minimo_ordine, multiplo, soglia_esaurimento, attivo, visibile_privati, linea:linea_id(id, nome), area:area_id(id, nome)")
    .order("nome");
  let qLotti = db.from("lotti").select("id, prodotto_codice, deposito_id, codice_lotto, scadenza, giacenza, sconto_manuale");
  let qGiacenze = db.from("giacenze_prodotto").select("prodotto_codice, deposito_id, totale_dichiarato");
  if (opzioni.codice) {
    qProdotti = qProdotti.eq("codice", opzioni.codice);
    qLotti = qLotti.eq("prodotto_codice", opzioni.codice);
    qGiacenze = qGiacenze.eq("prodotto_codice", opzioni.codice);
  }

  const gruppoId = opzioni.farmaciaId
    ? (((await db.from("farmacie").select("gruppo_id").eq("id", opzioni.farmaciaId).maybeSingle()).data?.gruppo_id as string | null) ?? null)
    : null;

  const [imp, fasce, prodotti, lotti, giacenze, disp, promo, listino] = await Promise.all([
    db.from("impostazioni").select("iva_predefinita, giorni_validita_prenotazione, giorni_consegna_indicativi, soglia_minima_ordine_cent, soglia_esaurimento_default, mesi_non_vendibile, mesi_durata_residua_garantita").single(),
    db.from("fasce_sconto").select("mesi_minimi, sconto_percentuale").eq("attiva", true),
    qProdotti,
    qLotti,
    qGiacenze,
    db.rpc("disponibilita_lotti", opzioni.codice ? { p_prodotto: opzioni.codice } : {}),
    db.from("promozioni").select("*").lte("inizio", oggi).gte("fine", oggi).eq("sospesa", false),
    gruppoId
      ? db.from("listini_gruppo").select("prodotto_codice, prezzo_pubblico_cent, sconto_percentuale").eq("gruppo_id", gruppoId)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [imp, fasce, prodotti, lotti, giacenze, disp, promo, listino]) if (r.error) throw new Error(r.error.message);

  const impostazioni = { ...(imp.data as Impostazioni), iva_predefinita: Number(imp.data!.iva_predefinita) };
  const fasceNum: Fascia[] = (fasce.data ?? []).map((f) => ({ mesi_minimi: f.mesi_minimi, sconto_percentuale: Number(f.sconto_percentuale) }));
  const disponibile = new Map(((disp.data ?? []) as { lotto_id: string; disponibile: number }[]).map((d) => [d.lotto_id, d.disponibile]));
  const lottiPerProdotto = Map.groupBy((lotti.data ?? []) as RigaLotto[], (l) => l.prodotto_codice);
  const giacenzePerProdotto = Map.groupBy(
    (giacenze.data ?? []) as { prodotto_codice: string; deposito_id: string; totale_dichiarato: number }[],
    (g) => g.prodotto_codice,
  );
  const promozioni = (promo.data ?? []) as Promozione[];
  const perGruppo = new Map(
    ((listino.data ?? []) as { prodotto_codice: string; prezzo_pubblico_cent: number | null; sconto_percentuale: number | null }[]).map((l) => [l.prodotto_codice, l]),
  );
  const chi = { gruppoId };

  const risultato: ProdottoCatalogo[] = [];
  for (const p of (prodotti.data ?? []) as unknown as RigaProdotto[]) {
    const iva = aliquotaProdotto(p.iva_override == null ? null : Number(p.iva_override), impostazioni.iva_predefinita);
    const dedicato = perGruppo.get(p.codice);
    const prezzo = dedicato?.prezzo_pubblico_cent ?? p.prezzo_pubblico_cent;
    const scontoGruppo = dedicato?.sconto_percentuale == null ? null : Number(dedicato.sconto_percentuale);
    const righeLotti = (lottiPerProdotto.get(p.codice) ?? []).filter((l) => l.giacenza > 0);
    const base = righeLotti.map((l) => ({ ...l, disponibile: disponibile.get(l.id) ?? l.giacenza }));
    const difforme = haDifformita(
      (lottiPerProdotto.get(p.codice) ?? []).map((l) => ({ ...l, disponibile: 0 })),
      giacenzePerProdotto.get(p.codice) ?? [],
    );

    const lottiCatalogo: LottoCatalogo[] = base.map((l) => {
      const stato = statoLotto(l, { oggi, difforme, conPrezzo: prezzo != null, mesiNonVendibile: impostazioni.mesi_non_vendibile });
      const cosa = { prodotto: p.codice, lineaId: p.linea?.id ?? null, lottoId: l.id };
      const sconto =
        stato === "vendibile" || stato === "esaurito"
          ? scontoPerLotto({
              scadenza: l.scadenza!,
              oggi,
              fasce: fasceNum,
              scontoManuale: l.sconto_manuale == null ? null : Number(l.sconto_manuale),
              promozione: migliorScontoPromo(promozioni, cosa, chi, oggi),
              scontoGruppo,
            })
          : null;
      return {
        id: l.id,
        codice_lotto: l.codice_lotto,
        scadenza: l.scadenza,
        deposito_id: l.deposito_id,
        disponibile: Math.max(l.disponibile, 0),
        stato,
        sconto,
        prezzi: sconto && prezzo != null ? calcolaPrezzi(prezzo, iva, sconto.sconto) : null,
        durataRidotta: sottoDurataGarantita(l.scadenza, oggi, impostazioni.mesi_durata_residua_garantita),
        promoExtra: stato === "vendibile" ? promozioni.filter((pr) => promozioneSiApplica(pr, cosa, chi, oggi)).map(promoExtra).filter((x): x is PromoExtra => x !== null) : [],
        promoMerce: stato === "vendibile" ? promoMerce(promozioni, cosa, chi, oggi).map(({ id, nome, tipo, compra, omaggio_quantita, omaggio_prodotto_codice }) => ({ id, nome, tipo, compra, omaggio_quantita, omaggio_prodotto_codice })) : [],
      };
    });

    const { stato, disponibile: totale } = statoProdotto({ ...p, prezzo_pubblico_cent: prezzo }, lottiCatalogo.map((l, i) => ({ ...base[i], stato: l.stato })), {
      difforme,
      sogliaEsaurimentoPredefinita: impostazioni.soglia_esaurimento_default,
    });
    if (stato === "non_visibile" && !opzioni.includiNonVisibili) continue;

    const visibili = lottiCatalogo.filter((l) => lottoVisibile(l.stato)).sort((a, b) => (a.scadenza ?? "9999").localeCompare(b.scadenza ?? "9999"));
    const vendibili = visibili.filter((l) => l.stato === "vendibile" && l.prezzi);
    const prezzoMigliore = vendibili.reduce<Prezzi | null>((m, l) => (!m || l.prezzi!.farmaciaNettoCent < m.farmaciaNettoCent ? l.prezzi : m), null);

    risultato.push({
      codice: p.codice,
      nome: p.nome,
      formato: p.formato,
      descrizione: p.descrizione,
      linea: p.linea,
      area: p.area,
      immagine_path: p.immagine_path,
      iva,
      prezzo_pubblico_cent: prezzo,
      prezzoDiGruppo: dedicato?.prezzo_pubblico_cent != null,
      visibile_privati: p.visibile_privati,
      minimo_ordine: p.minimo_ordine,
      multiplo: p.multiplo,
      stato,
      disponibile: totale,
      lotti: visibili,
      prezzoMigliore,
    });
  }

  // Offerte in corso con volantino che valgono per questa farmacia e per almeno un lotto vendibile
  const offerte: OffertaConVolantino[] = promozioni
    .filter((p) => p.immagine_path && statoPromozione(p, oggi) === "attiva" && (!p.gruppo_id || p.gruppo_id === gruppoId))
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      immagine_path: p.immagine_path!,
      fine: p.fine,
      prodotti: risultato
        .filter((x) => x.lotti.some((l) => l.stato === "vendibile" && promozioneSiApplica(p, { prodotto: x.codice, lineaId: x.linea?.id ?? null, lottoId: l.id }, chi, oggi)))
        .map((x) => x.codice),
    }))
    .filter((o) => o.prodotti.length > 0);

  return { oggi, impostazioni, fasce: fasceNum, prodotti: risultato, offerte };
}
