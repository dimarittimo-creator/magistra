"use server";

import { revalidatePath } from "next/cache";
import { richiediPrivato } from "@/lib/auth";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { caricaNegozio, lottiPerQuantita } from "@/lib/negozio";
import { creaClientServer } from "@/lib/supabase/server";

function quantita(fd: FormData) {
  const q = Number(String(fd.get("quantita") ?? ""));
  return Number.isInteger(q) && q >= 1 && q <= 99 ? q : null;
}

export async function aggiungiProdotto(codice: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const { privatoId } = await richiediPrivato();
  const q = quantita(fd);
  if (!q) return { messaggio: "Scegli una quantità da 1 a 99." };
  const db = await creaClientServer();
  const negozio = await caricaNegozio({ codice });
  const prodotto = negozio.prodotti[0];
  if (!prodotto?.disponibile) return { messaggio: "Al momento non disponibile." };
  const { data: presente } = await db.from("carrello_privati").select("quantita").eq("privato_id", privatoId).eq("prodotto_codice", codice).maybeSingle();
  const totale = (presente?.quantita ?? 0) + q;
  if (totale > 99 || !lottiPerQuantita(prodotto, totale, negozio)) return { messaggio: "Quantità non disponibile: prova con meno pezzi." };
  const { error } = await db.from("carrello_privati").upsert({ privato_id: privatoId, prodotto_codice: codice, quantita: totale });
  if (error) return { messaggio: "Non è stato possibile aggiornare il carrello. Riprova." };
  revalidatePath("/negozio", "layout");
  return { ok: true, messaggio: `Aggiunto al carrello (${totale} ${totale === 1 ? "pezzo" : "pezzi"}).` };
}

export async function aggiornaProdotto(codice: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const { privatoId } = await richiediPrivato();
  const db = await creaClientServer();
  if (fd.get("azione") === "rimuovi") {
    await db.from("carrello_privati").delete().eq("privato_id", privatoId).eq("prodotto_codice", codice);
  } else {
    const q = quantita(fd);
    if (!q) return { messaggio: "Quantità da 1 a 99" };
    await db.from("carrello_privati").update({ quantita: q }).eq("privato_id", privatoId).eq("prodotto_codice", codice);
  }
  revalidatePath("/negozio", "layout");
  return { ok: true };
}
