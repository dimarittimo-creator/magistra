// Scrittura nel database dei file di magazzino già letti, controllati e confermati.
// Usa il client con chiave di servizio: la chiamano l'import dall'area admin (dopo l'anteprima)
// e lo script di import iniziale. Ogni import ha la sua riga in import_magazzino.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataISO } from "@/lib/date";
import type { GiacenzaLetta } from "./giacenza";
import type { ListinoLetto } from "./listino";
import type { ModelloLetto } from "./modello";

export type ContenutoImport =
  | { tipo: "deposito_crystal"; giacenza: GiacenzaLetta }
  | { tipo: "listino"; listino: ListinoLetto }
  /** depositi: nome nel file → id della sede */
  | { tipo: "modello"; modello: ModelloLetto; depositi: Record<string, string> };

export type RigaImport = {
  id: string;
  tipo: ContenutoImport["tipo"];
  deposito_id: string | null;
  data_giacenza: DataISO | null;
  contenuto: ContenutoImport;
};

type LottoDaScrivere = { codice_lotto: string; scadenza: DataISO | null; quantita: number; sconto_manuale?: number | null };
type ProdottoDaScrivere = { codice: string; totale: number; lotti: LottoDaScrivere[] };

function errore(e: { message: string } | null) {
  if (e) throw new Error(e.message);
}

/** Registra un import (in anteprima o già applicato) e ne restituisce l'id. */
export async function creaImport(
  db: SupabaseClient,
  dati: { tipo: ContenutoImport["tipo"]; fileNome: string; depositoId?: string | null; dataGiacenza?: DataISO | null; contenuto: ContenutoImport; riepilogo?: unknown; utente?: string | null },
): Promise<string> {
  const { data, error } = await db
    .from("import_magazzino")
    .insert({
      tipo: dati.tipo,
      file_nome: dati.fileNome,
      deposito_id: dati.depositoId ?? null,
      data_giacenza: dati.dataGiacenza ?? null,
      stato: "anteprima",
      contenuto: dati.contenuto,
      riepilogo: dati.riepilogo ?? null,
      utente: dati.utente ?? null,
    })
    .select("id")
    .single();
  errore(error);
  return data!.id as string;
}

/**
 * Lotti e giacenze di un deposito. `azzera` decide cosa succede ai lotti non presenti nel file:
 * "deposito" (file completo del deposito) → tutti a 0; "prodotti" (modello parziale) → solo quelli dei prodotti nel file.
 */
async function scriviLotti(db: SupabaseClient, imp: { id: string; depositoId: string; data: DataISO }, prodotti: ProdottoDaScrivere[], azzera: "deposito" | "prodotti") {
  const adesso = new Date().toISOString();
  errore(
    (
      await db.from("giacenze_prodotto").upsert(
        prodotti.map((p) => ({ prodotto_codice: p.codice, deposito_id: imp.depositoId, totale_dichiarato: p.totale, data_giacenza: imp.data, import_id: imp.id, aggiornato_il: adesso })),
        { onConflict: "prodotto_codice,deposito_id" },
      )
    ).error,
  );
  const lotti = prodotti.flatMap((p) =>
    p.lotti.map((l) => ({
      prodotto_codice: p.codice,
      deposito_id: imp.depositoId,
      codice_lotto: l.codice_lotto,
      scadenza: l.scadenza,
      giacenza: l.quantita,
      data_giacenza: imp.data,
      import_id: imp.id,
      ...(l.sconto_manuale !== undefined ? { sconto_manuale: l.sconto_manuale } : {}),
    })),
  );
  // Righe con e senza sconto separate: upsert su chiavi uguali in ogni blocco
  const conSconto = lotti.filter((l) => "sconto_manuale" in l);
  const senzaSconto = lotti.filter((l) => !("sconto_manuale" in l));
  for (const blocco of [conSconto, senzaSconto]) {
    if (blocco.length) errore((await db.from("lotti").upsert(blocco, { onConflict: "prodotto_codice,deposito_id,codice_lotto" })).error);
  }

  let assenti = db.from("lotti").select("id").eq("deposito_id", imp.depositoId).neq("import_id", imp.id).gt("giacenza", 0);
  let assentiTotali = db.from("giacenze_prodotto").update({ totale_dichiarato: 0, data_giacenza: imp.data, import_id: imp.id }).eq("deposito_id", imp.depositoId).neq("import_id", imp.id);
  if (azzera === "prodotti") {
    const codici = prodotti.map((p) => p.codice);
    assenti = assenti.in("prodotto_codice", codici);
    assentiTotali = assentiTotali.in("prodotto_codice", codici);
  }
  const { data: spariti } = await assenti;
  if (spariti?.length) errore((await db.from("lotti").update({ giacenza: 0, data_giacenza: imp.data }).in("id", spariti.map((l) => l.id))).error);
  if (azzera === "deposito") errore((await assentiTotali).error);
  return spariti?.length ?? 0;
}

async function idPerNome(db: SupabaseClient, tabella: "linee" | "aree_terapeutiche", nomi: string[]): Promise<Map<string, string>> {
  const unici = [...new Set(nomi.filter(Boolean))];
  if (!unici.length) return new Map();
  const { data: esistenti } = await db.from(tabella).select("id, nome");
  const mappa = new Map((esistenti ?? []).map((r) => [String(r.nome).toLowerCase(), r.id as string]));
  const nuovi = unici.filter((n) => !mappa.has(n.toLowerCase()));
  if (nuovi.length) {
    const { data, error } = await db.from(tabella).insert(nuovi.map((nome) => ({ nome }))).select("id, nome");
    errore(error);
    for (const r of data ?? []) mappa.set(String(r.nome).toLowerCase(), r.id as string);
  }
  return mappa;
}

/** Applica un import in anteprima e lo segna come applicato. Restituisce gli avvisi. */
export async function applicaImport(db: SupabaseClient, imp: RigaImport): Promise<string[]> {
  const avvisi: string[] = [];
  const c = imp.contenuto;

  if (c.tipo === "deposito_crystal") {
    if (!imp.deposito_id || !imp.data_giacenza) throw new Error("Deposito e data della giacenza sono obbligatori");
    const { data: esistenti } = await db.from("prodotti").select("codice, nome").in("codice", c.giacenza.prodotti.map((p) => p.codice));
    const nomi = new Map((esistenti ?? []).map((p) => [p.codice as string, p.nome as string]));
    const nuovi = c.giacenza.prodotti.filter((p) => !nomi.has(p.codice)).length;
    if (nuovi) avvisi.push(`${nuovi} prodotti nuovi creati senza prezzo: non visibili finché non si inserisce il prezzo`);
    // Per i prodotti esistenti si aggiornano solo descrizione e codice interno del deposito, mai nome e prezzo.
    errore(
      (
        await db.from("prodotti").upsert(
          c.giacenza.prodotti.map((p) => ({ codice: p.codice, nome: nomi.get(p.codice) ?? p.descrizione, descrizione_deposito: p.descrizione, codice_interno_deposito: p.codice_interno })),
          { onConflict: "codice" },
        )
      ).error,
    );
    const azzerati = await scriviLotti(
      db,
      { id: imp.id, depositoId: imp.deposito_id, data: imp.data_giacenza },
      c.giacenza.prodotti.map((p) => ({ codice: p.codice, totale: p.totale_dichiarato, lotti: p.lotti.map((l) => ({ codice_lotto: l.codice_lotto, scadenza: l.scadenza, quantita: l.quantita })) })),
      "deposito",
    );
    if (azzerati) avvisi.push(`${azzerati} lotti non più presenti nel file: giacenza portata a 0`);
  }

  if (c.tipo === "listino") {
    errore((await db.from("prodotti").upsert(c.listino.voci.map((v) => ({ codice: v.codice, nome: v.nome, prezzo_pubblico_cent: v.prezzo_pubblico_cent })), { onConflict: "codice" })).error);
  }

  if (c.tipo === "modello") {
    if (!imp.data_giacenza) throw new Error("La data della giacenza è obbligatoria");
    const linee = await idPerNome(db, "linee", c.modello.prodotti.map((p) => p.linea ?? ""));
    const aree = await idPerNome(db, "aree_terapeutiche", c.modello.prodotti.map((p) => p.area ?? ""));
    errore(
      (
        await db.from("prodotti").upsert(
          c.modello.prodotti.map((p) => ({
            codice: p.codice,
            nome: p.nome,
            formato: p.formato,
            linea_id: p.linea ? linee.get(p.linea.toLowerCase()) : null,
            area_id: p.area ? aree.get(p.area.toLowerCase()) : null,
            prezzo_pubblico_cent: p.prezzo_pubblico_cent,
            iva_override: p.iva_override,
            visibile_privati: p.visibile_privati,
          })),
          { onConflict: "codice" },
        )
      ).error,
    );
    for (const [nomeDeposito, depositoId] of Object.entries(c.depositi)) {
      const prodotti = c.modello.prodotti
        .filter((p) => p.lotti.some((l) => l.deposito === nomeDeposito))
        .map((p) => ({
          codice: p.codice,
          totale: p.totali[nomeDeposito] ?? 0,
          lotti: p.lotti.filter((l) => l.deposito === nomeDeposito).map((l) => ({ codice_lotto: l.codice_lotto, scadenza: l.scadenza, quantita: l.quantita, sconto_manuale: l.sconto_manuale })),
        }));
      const azzerati = await scriviLotti(db, { id: imp.id, depositoId, data: imp.data_giacenza }, prodotti, "prodotti");
      if (azzerati) avvisi.push(`${nomeDeposito}: ${azzerati} lotti non più presenti nel file portati a 0`);
    }
  }

  // Giacenza scesa sotto la merce già prenotata negli ordini aperti
  const { data: disp } = await db.rpc("disponibilita_lotti");
  const sotto = ((disp ?? []) as { disponibile: number }[]).filter((d) => d.disponibile < 0).length;
  if (sotto) avvisi.push(`${sotto} lotti hanno ora una giacenza inferiore alla merce già prenotata: controlla gli ordini aperti`);

  errore((await db.from("import_magazzino").update({ stato: "applicato", applicato_il: new Date().toISOString(), avvisi }).eq("id", imp.id)).error);
  return avvisi;
}
