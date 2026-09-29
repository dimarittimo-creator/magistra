"use server";

import { revalidatePath } from "next/cache";
import { richiediFarmaciaAttiva } from "@/lib/auth";
import { caricaCatalogo } from "@/lib/catalogo";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { creaClientServer } from "@/lib/supabase/server";

function leggiQuantita(fd: FormData): number | null {
  const q = Number(String(fd.get("quantita") ?? "").trim());
  return Number.isInteger(q) && q > 0 && q <= 100000 ? q : null;
}

/** Aggiunge pezzi di un lotto al carrello, senza superare il disponibile. */
export async function aggiungiAlCarrello(lottoId: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const { farmaciaId } = await richiediFarmaciaAttiva();
  const quantita = leggiQuantita(fd);
  if (!quantita) return { messaggio: "Indica una quantità valida." };

  const db = await creaClientServer();
  const { data: riga } = await db.from("lotti").select("prodotto_codice").eq("id", lottoId).maybeSingle();
  if (!riga) return { messaggio: "Lotto non trovato." };
  const catalogo = await caricaCatalogo(db, { codice: riga.prodotto_codice, farmaciaId });
  const lotto = catalogo.prodotti[0]?.lotti.find((l) => l.id === lottoId);
  if (!lotto || lotto.stato !== "vendibile") return { messaggio: "Questo lotto non è più disponibile." };

  const { data: presente } = await db.from("carrello_righe").select("quantita").eq("farmacia_id", farmaciaId).eq("lotto_id", lottoId).maybeSingle();
  const totale = (presente?.quantita ?? 0) + quantita;
  if (totale > lotto.disponibile) {
    return {
      messaggio: presente
        ? `Nel carrello hai già ${presente.quantita} pezzi di questo lotto: ne puoi aggiungere al massimo ${Math.max(lotto.disponibile - presente.quantita, 0)}.`
        : `Disponibili solo ${lotto.disponibile} pezzi di questo lotto.`,
    };
  }

  const { error } = await db.from("carrello_righe").upsert({ farmacia_id: farmaciaId, lotto_id: lottoId, quantita: totale });
  if (error) return { messaggio: "Non è stato possibile aggiornare il carrello. Riprova." };
  revalidatePath("/farmacia", "layout");
  return { ok: true, messaggio: `Nel carrello: ${totale} pezzi del lotto ${lotto.codice_lotto}.` };
}

export async function aggiornaRigaCarrello(lottoId: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const { farmaciaId } = await richiediFarmaciaAttiva();
  const db = await creaClientServer();
  if (fd.get("azione") === "rimuovi") {
    await db.from("carrello_righe").delete().eq("farmacia_id", farmaciaId).eq("lotto_id", lottoId);
  } else {
    const quantita = leggiQuantita(fd);
    if (!quantita) return { messaggio: "Quantità non valida" };
    await db.from("carrello_righe").update({ quantita }).eq("farmacia_id", farmaciaId).eq("lotto_id", lottoId);
  }
  revalidatePath("/farmacia", "layout");
  return { ok: true };
}

export async function svuotaCarrello() {
  const { farmaciaId } = await richiediFarmaciaAttiva();
  const db = await creaClientServer();
  await db.from("carrello_righe").delete().eq("farmacia_id", farmaciaId);
  revalidatePath("/farmacia", "layout");
}
