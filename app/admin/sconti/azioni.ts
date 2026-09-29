"use server";

import { revalidatePath } from "next/cache";
import { richiediAdmin } from "@/lib/auth";
import type { StatoModulo } from "@/lib/farmacie/dati";
import { registraOperazione } from "@/lib/registro";
import { validaFasce, type FasciaModifica } from "@/lib/sconti";
import { creaClientServer } from "@/lib/supabase/server";

export type ModificheSconti = {
  fasce: FasciaModifica[];
  iva_predefinita: number;
  prezzi: Record<string, number | null>; // codice → centesimi
  iva_prodotti: Record<string, number | null>; // codice → aliquota (null = predefinita)
  sconti_lotto: Record<string, number | null>; // id lotto → % (null = fascia)
};

export async function salvaSconti(modifiche: ModificheSconti): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const errori = validaFasce(modifiche.fasce, modifiche.iva_predefinita);
  const prezziErrati = Object.values(modifiche.prezzi).some((c) => c != null && (!Number.isInteger(c) || c <= 0));
  const ivaErrate = Object.values(modifiche.iva_prodotti).some((v) => v != null && (v < 0 || v > 100));
  const scontiErrati = Object.values(modifiche.sconti_lotto).some((v) => v != null && (v < 0 || v > 100));
  if (prezziErrati) errori.push("Un prezzo non è valido.");
  if (ivaErrate) errori.push("Un'aliquota IVA non è valida.");
  if (scontiErrati) errori.push("Uno sconto sul lotto non è valido.");
  if (errori.length) return { messaggio: errori.join(" ") };

  const db = await creaClientServer();
  const [{ data: fascePrima }, { data: imp }] = await Promise.all([
    db.from("fasce_sconto").select("id, mesi_minimi, sconto_percentuale"),
    db.from("impostazioni").select("iva_predefinita").single(),
  ]);

  // Fasce: si aggiornano quelle con gli stessi mesi, si aggiungono le nuove, si tolgono le altre.
  const esistenti = new Map((fascePrima ?? []).map((f) => [f.mesi_minimi as number, f]));
  for (const f of modifiche.fasce) {
    const e = esistenti.get(f.mesi_minimi);
    if (e && Number(e.sconto_percentuale) !== f.sconto_percentuale) {
      const { error } = await db.from("fasce_sconto").update({ sconto_percentuale: f.sconto_percentuale }).eq("id", e.id);
      if (error) return { messaggio: "Salvataggio delle fasce non riuscito." };
    } else if (!e) {
      const { error } = await db.from("fasce_sconto").insert(f);
      if (error) return { messaggio: "Salvataggio delle fasce non riuscito." };
    }
  }
  const daTogliere = (fascePrima ?? []).filter((f) => !modifiche.fasce.some((n) => n.mesi_minimi === f.mesi_minimi)).map((f) => f.id);
  if (daTogliere.length) await db.from("fasce_sconto").delete().in("id", daTogliere);

  if (Number(imp?.iva_predefinita) !== modifiche.iva_predefinita) {
    await db.from("impostazioni").update({ iva_predefinita: modifiche.iva_predefinita }).eq("id", true);
  }
  for (const [codice, prezzo] of Object.entries(modifiche.prezzi)) {
    await db.from("prodotti").update({ prezzo_pubblico_cent: prezzo }).eq("codice", codice);
  }
  for (const [codice, iva] of Object.entries(modifiche.iva_prodotti)) {
    await db.from("prodotti").update({ iva_override: iva }).eq("codice", codice);
  }
  for (const [id, sconto] of Object.entries(modifiche.sconti_lotto)) {
    await db.from("lotti").update({ sconto_manuale: sconto }).eq("id", id);
  }

  await registraOperazione(db, utente.id, {
    azione: "modifica_sconti_prezzi",
    entita: "fasce_sconto",
    prima: { fasce: fascePrima, iva_predefinita: imp?.iva_predefinita },
    dopo: modifiche,
  });
  revalidatePath("/", "layout");
  return { ok: true, messaggio: "Modifiche salvate: i prezzi delle farmacie sono già aggiornati." };
}
