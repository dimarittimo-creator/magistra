// Scrittura nel database di giacenza e listino già letti e controllati.
// Usa il client con chiave di servizio: la chiamano solo lo script di import iniziale
// e (dalla Fase 3) l'azione admin dopo la conferma dell'anteprima.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataISO } from "@/lib/date";
import type { GiacenzaLetta } from "./giacenza";
import type { ListinoLetto } from "./listino";

export type EsitoImport = { importId: string; avvisi: string[] };

export async function applicaGiacenza(
  db: SupabaseClient,
  giacenza: GiacenzaLetta,
  opzioni: { depositoId: string; dataGiacenza: DataISO; fileNome: string; utente?: string | null },
): Promise<EsitoImport> {
  const avvisi: string[] = [];
  const { data: imp, error: e1 } = await db
    .from("import_magazzino")
    .insert({
      tipo: "deposito_crystal",
      file_nome: opzioni.fileNome,
      deposito_id: opzioni.depositoId,
      data_giacenza: opzioni.dataGiacenza,
      stato: "applicato",
      riepilogo: giacenza.totali,
      avvisi: giacenza.errori,
      utente: opzioni.utente ?? null,
      applicato_il: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (e1) throw e1;
  const importId = imp.id as string;

  // Prodotti: i nuovi si creano non visibili (senza prezzo); per gli esistenti si aggiornano
  // solo descrizione e codice interno del deposito, mai nome e prezzo.
  const codici = giacenza.prodotti.map((p) => p.codice);
  const { data: esistenti } = await db.from("prodotti").select("codice, nome").in("codice", codici);
  const nomi = new Map((esistenti ?? []).map((p) => [p.codice as string, p.nome as string]));
  const nuovi = giacenza.prodotti.filter((p) => !nomi.has(p.codice));
  if (nuovi.length) avvisi.push(`${nuovi.length} prodotti nuovi creati senza prezzo (non visibili finché non si inserisce il prezzo)`);
  const { error: e2 } = await db.from("prodotti").upsert(
    giacenza.prodotti.map((p) => ({
      codice: p.codice,
      nome: nomi.get(p.codice) ?? p.descrizione,
      descrizione_deposito: p.descrizione,
      codice_interno_deposito: p.codice_interno,
    })),
    { onConflict: "codice" },
  );
  if (e2) throw e2;

  const { error: e3 } = await db.from("giacenze_prodotto").upsert(
    giacenza.prodotti.map((p) => ({
      prodotto_codice: p.codice,
      deposito_id: opzioni.depositoId,
      totale_dichiarato: p.totale_dichiarato,
      data_giacenza: opzioni.dataGiacenza,
      import_id: importId,
      aggiornato_il: new Date().toISOString(),
    })),
    { onConflict: "prodotto_codice,deposito_id" },
  );
  if (e3) throw e3;

  // Lotti: lo sconto manuale già impostato resta.
  const { error: e4 } = await db.from("lotti").upsert(
    giacenza.prodotti.flatMap((p) =>
      p.lotti.map((l) => ({
        prodotto_codice: p.codice,
        deposito_id: opzioni.depositoId,
        codice_lotto: l.codice_lotto,
        scadenza: l.scadenza,
        giacenza: l.quantita,
        data_giacenza: opzioni.dataGiacenza,
        import_id: importId,
      })),
    ),
    { onConflict: "prodotto_codice,deposito_id,codice_lotto" },
  );
  if (e4) throw e4;

  // Prodotti e lotti di questo deposito spariti dal file: giacenza a 0.
  const { data: spariti } = await db
    .from("lotti")
    .select("id, prodotto_codice, codice_lotto")
    .eq("deposito_id", opzioni.depositoId)
    .neq("import_id", importId)
    .gt("giacenza", 0);
  if (spariti?.length) {
    avvisi.push(`${spariti.length} lotti non più presenti nel file: giacenza portata a 0`);
    const { error } = await db.from("lotti").update({ giacenza: 0, data_giacenza: opzioni.dataGiacenza }).in("id", spariti.map((l) => l.id));
    if (error) throw error;
  }
  const { error: e5 } = await db
    .from("giacenze_prodotto")
    .update({ totale_dichiarato: 0, data_giacenza: opzioni.dataGiacenza, import_id: importId })
    .eq("deposito_id", opzioni.depositoId)
    .neq("import_id", importId);
  if (e5) throw e5;

  // Giacenza scesa sotto la merce già impegnata negli ordini aperti.
  const { data: disp } = await db.rpc("disponibilita_lotti");
  const sotto = ((disp ?? []) as { lotto_id: string; disponibile: number }[]).filter((d) => d.disponibile < 0);
  if (sotto.length) avvisi.push(`${sotto.length} lotti hanno ora una giacenza inferiore alla merce già prenotata`);

  await db.from("import_magazzino").update({ avvisi: { errori: giacenza.errori, avvisi } }).eq("id", importId);
  return { importId, avvisi };
}

export async function applicaListino(
  db: SupabaseClient,
  listino: ListinoLetto,
  opzioni: { fileNome: string; utente?: string | null },
): Promise<EsitoImport> {
  const { data: imp, error: e1 } = await db
    .from("import_magazzino")
    .insert({
      tipo: "listino",
      file_nome: opzioni.fileNome,
      stato: "applicato",
      riepilogo: { voci: listino.voci.length },
      avvisi: listino.errori,
      utente: opzioni.utente ?? null,
      applicato_il: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (e1) throw e1;

  const { error } = await db.from("prodotti").upsert(
    listino.voci.map((v) => ({ codice: v.codice, nome: v.nome, prezzo_pubblico_cent: v.prezzo_pubblico_cent })),
    { onConflict: "codice" },
  );
  if (error) throw error;
  return { importId: imp.id as string, avvisi: [] };
}
