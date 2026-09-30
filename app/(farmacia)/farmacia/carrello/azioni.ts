"use server";

import { revalidatePath } from "next/cache";
import { richiediFarmaciaAttiva } from "@/lib/auth";
import { aggiungiLottoAlCarrello } from "@/lib/carrello";
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

  const esito = await aggiungiLottoAlCarrello(await creaClientServer(), farmaciaId, lottoId, quantita);
  if (!esito.ok) return { messaggio: esito.messaggio };
  revalidatePath("/farmacia", "layout");
  return { ok: true, messaggio: esito.messaggio };
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
