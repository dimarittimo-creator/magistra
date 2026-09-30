import "server-only";
import { assegnaLottiPrivato, disponibilePrivati } from "@/lib/availability";
import { caricaCatalogo, type LottoCatalogo } from "@/lib/catalogo";
import { oggiRoma, type DataISO } from "@/lib/date";
import { prezzoPrivato, type PrezzoPrivato } from "@/lib/pricing";
import { migliorScontoPrivati, type ScontoPrivati } from "@/lib/sconti-privati";
import { creaClientAdmin } from "@/lib/supabase/admin";

// Negozio dei privati (docs/AREA_PRIVATI.md §2). Si legge con la chiave di servizio perché è consultabile
// anche senza account, ma espone solo ciò che i privati possono vedere: prezzo pieno, sconto del mese,
// prezzo finale IVA inclusa e disponibile sì/no. Lotti, giacenze, prezzi e sconti farmacia restano sul server.

export type ProdottoNegozio = {
  codice: string;
  nome: string;
  formato: string | null;
  descrizione: string | null;
  linea: { id: string; nome: string } | null;
  immagine_path: string | null;
  iva: number;
  prezzo: PrezzoPrivato;
  disponibile: boolean;
};

/** Dati interni per carrello e invio: mai passati alla pagina. */
export type ProdottoNegozioInterno = ProdottoNegozio & { quantitaDisponibile: number; lotti: LottoCatalogo[] };

export type Negozio = {
  oggi: DataISO;
  mesiMinimi: number;
  giorniConsegna: number;
  aperta: boolean;
  prodotti: ProdottoNegozioInterno[];
};

/** L'area Privati è aperta se attivata dall'admin; in locale si può provare anche prima. */
export async function areaPrivatiAperta(): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return true;
  const { data } = await creaClientAdmin().from("impostazioni").select("area_privati_attiva").single();
  return Boolean(data?.area_privati_attiva);
}

export async function caricaNegozio(opzioni: { codice?: string; oggi?: DataISO } = {}): Promise<Negozio> {
  const db = creaClientAdmin();
  const oggi = opzioni.oggi ?? oggiRoma();
  const [catalogo, { data: sconti }, { data: imp }, aperta] = await Promise.all([
    caricaCatalogo(db, { codice: opzioni.codice, oggi }),
    db.from("sconti_privati").select("id, ambito, linea_id, prodotto_codice, sconto_percentuale, inizio, fine").lte("inizio", oggi).gte("fine", oggi),
    db.from("impostazioni").select("mesi_minimi_lotto_privati, giorni_consegna_indicativi").single(),
    areaPrivatiAperta(),
  ]);
  const mesiMinimi = imp?.mesi_minimi_lotto_privati ?? 6;
  const attivi = ((sconti ?? []) as ScontoPrivati[]).map((s) => ({ ...s, sconto_percentuale: Number(s.sconto_percentuale) }));

  const prodotti = catalogo.prodotti
    .filter((p) => p.visibile_privati && p.prezzo_pubblico_cent != null)
    .map((p) => {
      const sconto = migliorScontoPrivati(attivi, { codice: p.codice, lineaId: p.linea?.id ?? null }, oggi);
      const quantitaDisponibile = disponibilePrivati(p.lotti, { oggi, mesiMinimi });
      return {
        codice: p.codice,
        nome: p.nome,
        formato: p.formato,
        descrizione: p.descrizione,
        linea: p.linea,
        immagine_path: p.immagine_path,
        iva: p.iva,
        prezzo: prezzoPrivato(p.prezzo_pubblico_cent!, p.iva, sconto ? sconto.sconto_percentuale : null),
        disponibile: quantitaDisponibile > 0,
        quantitaDisponibile,
        lotti: p.lotti,
      };
    });
  return { oggi, mesiMinimi, giorniConsegna: imp?.giorni_consegna_indicativi ?? 5, aperta, prodotti };
}

/** Solo i campi visibili al cliente (da passare alle pagine). */
export function perIlCliente(p: ProdottoNegozioInterno): ProdottoNegozio {
  const { quantitaDisponibile: _q, lotti: _l, ...pubblico } = p;
  return pubblico;
}

/** Lotti da prelevare per una quantità, o null se non disponibile. */
export function lottiPerQuantita(p: ProdottoNegozioInterno, quantita: number, negozio: Pick<Negozio, "oggi" | "mesiMinimi">) {
  return assegnaLottiPrivato(p.lotti, quantita, { oggi: negozio.oggi, mesiMinimi: negozio.mesiMinimi });
}
