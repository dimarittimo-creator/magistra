"use server";

import { revalidatePath } from "next/cache";
import { richiediAdmin } from "@/lib/auth";
import { istanteRoma } from "@/lib/date";
import { leggi, valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { registraOperazione } from "@/lib/registro";
import { creaClientServer } from "@/lib/supabase/server";

const TIPI = ["privacy", "condizioni_farmacie", "condizioni_privati"] as const;

/** Pubblica una nuova versione di un testo legale. Le versioni precedenti restano (gli ordini citano quella accettata). */
export async function pubblicaVersione(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const valori = valoriModulo(fd);
  const tipo = leggi(fd, "tipo") as (typeof TIPI)[number];
  const titolo = leggi(fd, "titolo");
  const testo = String(fd.get("testo") ?? "").trim();
  const dal = leggi(fd, "in_vigore_dal");
  const errori: Record<string, string> = {};
  if (!TIPI.includes(tipo)) errori.tipo = "Tipo non valido";
  if (!titolo) errori.titolo = "Indica il titolo";
  if (testo.length < 20) errori.testo = "Il testo è troppo breve";
  if (dal && !/^\d{4}-\d{2}-\d{2}$/.test(dal)) errori.in_vigore_dal = "Data non valida";
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlla i campi evidenziati." };

  const db = await creaClientServer();
  const { data: ultima } = await db.from("documenti_legali").select("versione").eq("tipo", tipo).order("versione", { ascending: false }).limit(1).maybeSingle();
  const versione = (ultima?.versione ?? 0) + 1;
  const { data, error } = await db
    .from("documenti_legali")
    .insert({
      tipo,
      versione,
      titolo,
      testo,
      provvisorio: Boolean(fd.get("provvisorio")),
      in_vigore_dal: dal ? istanteRoma(dal, "00:00:00") : new Date().toISOString(),
      creato_da: utente.id,
    })
    .select("id")
    .single();
  if (error) return { valori, messaggio: "Pubblicazione non riuscita. Riprova." };
  await registraOperazione(db, utente.id, { azione: "pubblica_documento_legale", entita: "documenti_legali", entitaId: data.id, dopo: { tipo, versione, titolo } });
  revalidatePath("/", "layout");
  return { ok: true, messaggio: `Pubblicata la versione ${versione}. Da ora le nuove accettazioni useranno questa versione.` };
}
