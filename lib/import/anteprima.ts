// Anteprima di un import: cosa cambierebbe, con gli avvisi richiesti da docs/IMPORT_EXCEL.md
// (codici nuovi, lotti scaduti o senza scadenza, difformità, prodotti spariti, giacenza sotto l'impegnato).
// Nulla viene scritto: si confronta il file con il database.

import type { SupabaseClient } from "@supabase/supabase-js";
import { formattaData } from "@/lib/formato";
import type { DataISO } from "@/lib/date";
import type { ContenutoImport } from "./applica";

export type Avviso = { gravita: "errore" | "attenzione" | "info"; testo: string; dettagli?: string[] };
export type Differenza = { codice: string; nome: string; prima: string; dopo: string };

export type Anteprima = {
  titolo: string;
  numeri: { etichetta: string; valore: string }[];
  avvisi: Avviso[];
  differenze: Differenza[];
};

const fmt = (n: number) => n.toLocaleString("it-IT");
const euro = (c: number | null) => (c == null ? "—" : (c / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR" }));

type LottoDb = { id: string; prodotto_codice: string; codice_lotto: string; giacenza: number };

async function statoDeposito(db: SupabaseClient, depositoId: string) {
  const [{ data: giacenze }, { data: lotti }, { data: disp }, { data: prodotti }] = await Promise.all([
    db.from("giacenze_prodotto").select("prodotto_codice, totale_dichiarato").eq("deposito_id", depositoId),
    db.from("lotti").select("id, prodotto_codice, codice_lotto, giacenza").eq("deposito_id", depositoId),
    db.rpc("disponibilita_lotti"),
    db.from("prodotti").select("codice, nome, prezzo_pubblico_cent"),
  ]);
  return {
    totali: new Map((giacenze ?? []).map((g) => [g.prodotto_codice as string, g.totale_dichiarato as number])),
    lotti: (lotti ?? []) as LottoDb[],
    impegnato: new Map(((disp ?? []) as { lotto_id: string; impegnato: number }[]).map((d) => [d.lotto_id, d.impegnato])),
    prodotti: new Map((prodotti ?? []).map((p) => [p.codice as string, p as { codice: string; nome: string; prezzo_pubblico_cent: number | null }])),
  };
}

type ProdottoConfronto = { codice: string; nome: string; totale: number; lotti: { codice_lotto: string; scadenza: DataISO | null; quantita: number }[] };

function confrontaDeposito(stato: Awaited<ReturnType<typeof statoDeposito>>, prodotti: ProdottoConfronto[], oggi: DataISO, fileCompleto: boolean) {
  const avvisi: Avviso[] = [];
  const differenze: Differenza[] = [];
  const nelFile = new Set(prodotti.map((p) => p.codice));

  const nuovi = prodotti.filter((p) => !stato.prodotti.has(p.codice));
  if (nuovi.length) avvisi.push({ gravita: "info", testo: `${nuovi.length} codici non presenti nel catalogo: verranno creati come non visibili finché non hanno un prezzo`, dettagli: nuovi.map((p) => `${p.codice} ${p.nome}`) });

  const difformi = prodotti.filter((p) => p.lotti.reduce((s, l) => s + l.quantita, 0) !== p.totale);
  if (difformi.length) {
    avvisi.push({
      gravita: "attenzione",
      testo: `${difformi.length} prodotti con difformità tra somma dei lotti e giacenza dichiarata: saranno "Mancante temporaneamente"`,
      dettagli: difformi.map((p) => `${p.nome}: lotti ${fmt(p.lotti.reduce((s, l) => s + l.quantita, 0))}, totale dichiarato ${fmt(p.totale)}`),
    });
  }
  const senza = prodotti.flatMap((p) => p.lotti.filter((l) => !l.scadenza).map((l) => `${p.nome} – lotto ${l.codice_lotto}`));
  if (senza.length) avvisi.push({ gravita: "attenzione", testo: `${senza.length} lotti senza data di scadenza: saranno "Mancante"`, dettagli: senza });
  const scaduti = prodotti.flatMap((p) => p.lotti.filter((l) => l.scadenza && l.scadenza < oggi).map((l) => `${p.nome} – lotto ${l.codice_lotto} (scaduto il ${formattaData(l.scadenza!)})`));
  if (scaduti.length) avvisi.push({ gravita: "attenzione", testo: `${scaduti.length} lotti già scaduti: non saranno vendibili`, dettagli: scaduti });

  if (fileCompleto) {
    const spariti = [...stato.totali.entries()].filter(([codice, tot]) => tot > 0 && !nelFile.has(codice));
    if (spariti.length) avvisi.push({ gravita: "attenzione", testo: `${spariti.length} prodotti non sono più nel file: la loro giacenza andrà a 0`, dettagli: spariti.map(([c]) => `${c} ${stato.prodotti.get(c)?.nome ?? ""}`) });
  }

  const sotto: string[] = [];
  for (const p of prodotti) {
    for (const l of stato.lotti.filter((x) => x.prodotto_codice === p.codice)) {
      const impegnato = stato.impegnato.get(l.id) ?? 0;
      const nuovo = p.lotti.find((x) => x.codice_lotto === l.codice_lotto)?.quantita ?? 0;
      if (impegnato > 0 && nuovo < impegnato) sotto.push(`${p.nome} – lotto ${l.codice_lotto}: nuova giacenza ${fmt(nuovo)}, già prenotati ${fmt(impegnato)}`);
    }
  }
  if (sotto.length) avvisi.push({ gravita: "errore", testo: `${sotto.length} lotti avranno una giacenza inferiore alla merce già prenotata`, dettagli: sotto });

  for (const p of prodotti) {
    const prima = stato.totali.get(p.codice);
    if (prima !== p.totale) differenze.push({ codice: p.codice, nome: p.nome, prima: prima == null ? "—" : fmt(prima), dopo: fmt(p.totale) });
  }
  return { avvisi, differenze };
}

export async function calcolaAnteprima(db: SupabaseClient, contenuto: ContenutoImport, opzioni: { depositoId?: string | null; oggi: DataISO }): Promise<Anteprima> {
  if (contenuto.tipo === "deposito_crystal") {
    const g = contenuto.giacenza;
    const stato = await statoDeposito(db, opzioni.depositoId!);
    const { avvisi, differenze } = confrontaDeposito(
      stato,
      g.prodotti.map((p) => ({ codice: p.codice, nome: p.descrizione, totale: p.totale_dichiarato, lotti: p.lotti })),
      opzioni.oggi,
      true,
    );
    if (g.errori.length) avvisi.unshift({ gravita: "errore", testo: `${g.errori.length} righe non lette`, dettagli: g.errori.map((e) => `Riga ${e.riga}: ${e.messaggio}`) });
    return {
      titolo: "Giacenza del deposito",
      numeri: [
        { etichetta: "Prodotti", valore: fmt(g.totali.prodotti) },
        { etichetta: "Lotti", valore: fmt(g.totali.lotti) },
        { etichetta: "Pezzi", valore: fmt(g.totali.pezzi) },
        { etichetta: "Difformità", valore: fmt(g.totali.difformita) },
        { etichetta: "Lotti senza scadenza", valore: fmt(g.totali.senza_scadenza) },
      ],
      avvisi,
      differenze,
    };
  }

  if (contenuto.tipo === "listino") {
    const l = contenuto.listino;
    const { data: prodotti } = await db.from("prodotti").select("codice, nome, prezzo_pubblico_cent");
    const attuali = new Map((prodotti ?? []).map((p) => [p.codice as string, p]));
    const differenze: Differenza[] = l.voci
      .filter((v) => attuali.get(v.codice)?.prezzo_pubblico_cent !== v.prezzo_pubblico_cent)
      .map((v) => ({ codice: v.codice, nome: v.nome, prima: euro(attuali.get(v.codice)?.prezzo_pubblico_cent ?? null), dopo: euro(v.prezzo_pubblico_cent) }));
    const avvisi: Avviso[] = [];
    if (l.errori.length) avvisi.push({ gravita: "errore", testo: `${l.errori.length} righe non lette`, dettagli: l.errori.map((e) => `Riga ${e.riga}: ${e.messaggio}`) });
    const nuovi = l.voci.filter((v) => !attuali.has(v.codice));
    if (nuovi.length) avvisi.push({ gravita: "info", testo: `${nuovi.length} prodotti nuovi (senza lotti finché non arriva la giacenza)`, dettagli: nuovi.map((v) => `${v.codice} ${v.nome}`) });
    const senzaPrezzo = [...attuali.values()].filter((p) => !l.voci.some((v) => v.codice === p.codice) && p.prezzo_pubblico_cent == null);
    if (senzaPrezzo.length) avvisi.push({ gravita: "info", testo: `${senzaPrezzo.length} prodotti restano senza prezzo e non visibili`, dettagli: senzaPrezzo.map((p) => `${p.codice} ${p.nome}`) });
    return {
      titolo: "Listino prezzi",
      numeri: [
        { etichetta: "Prezzi nel file", valore: fmt(l.voci.length) },
        { etichetta: "Prezzi che cambiano", valore: fmt(differenze.length) },
      ],
      avvisi,
      differenze,
    };
  }

  const m = contenuto.modello;
  const avvisi: Avviso[] = [];
  const differenze: Differenza[] = [];
  if (m.errori.length) avvisi.push({ gravita: "errore", testo: `${m.errori.length} righe non lette`, dettagli: m.errori.map((e) => `Riga ${e.riga}: ${e.messaggio}`) });
  for (const [nome, id] of Object.entries(contenuto.depositi)) {
    const stato = await statoDeposito(db, id);
    const r = confrontaDeposito(
      stato,
      m.prodotti.filter((p) => p.lotti.some((l) => l.deposito === nome)).map((p) => ({ codice: p.codice, nome: p.nome, totale: p.totali[nome] ?? 0, lotti: p.lotti.filter((l) => l.deposito === nome) })),
      opzioni.oggi,
      false,
    );
    avvisi.push(...r.avvisi.map((a) => ({ ...a, testo: `${nome}: ${a.testo}` })));
    differenze.push(...r.differenze);
  }
  const { data: prodotti } = await db.from("prodotti").select("codice, prezzo_pubblico_cent");
  const prezzi = new Map((prodotti ?? []).map((p) => [p.codice as string, p.prezzo_pubblico_cent as number | null]));
  const cambiPrezzo = m.prodotti.filter((p) => prezzi.get(p.codice) !== p.prezzo_pubblico_cent);
  if (cambiPrezzo.length) avvisi.push({ gravita: "info", testo: `${cambiPrezzo.length} prezzi al pubblico cambiano`, dettagli: cambiPrezzo.map((p) => `${p.nome}: ${euro(prezzi.get(p.codice) ?? null)} → ${euro(p.prezzo_pubblico_cent)}`) });
  return {
    titolo: "Modello Magistra",
    numeri: [
      { etichetta: "Prodotti", valore: fmt(m.prodotti.length) },
      { etichetta: "Lotti", valore: fmt(m.prodotti.reduce((s, p) => s + p.lotti.length, 0)) },
      { etichetta: "Depositi", valore: fmt(Object.keys(contenuto.depositi).length) },
    ],
    avvisi,
    differenze,
  };
}
