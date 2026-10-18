"use server";

import { revalidatePath } from "next/cache";
import { richiediMedicoAttivo } from "@/lib/auth";
import { emailAmministrazione } from "@/lib/email/destinatari";
import { inviaEmail } from "@/lib/email/invia";
import { emailNuovaRichiestaCampioniAdmin } from "@/lib/email/modelli-medici";
import { leggi, valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { leggiSchede } from "@/lib/medici/contenuti";
import { indirizzoMedico } from "@/lib/medici/dati";
import { creaClientServer } from "@/lib/supabase/server";

/** Richiesta di campioni gratuiti (docs/AREA_MEDICI.md §2): spedizione all'indirizzo dello studio. */
export async function richiediCampioni(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediMedicoAttivo();
  const valori = valoriModulo(fd);
  const db = await creaClientServer();
  const [{ data: imp }, { data: medico }, schede] = await Promise.all([
    db.from("impostazioni").select("campioni_max_confezioni").single(),
    db.from("medici").select("nome, cognome, email, struttura, presso, indirizzo, cap, citta, provincia").eq("id", utente.medicoId).single(),
    leggiSchede(),
  ]);
  const massimo = imp?.campioni_max_confezioni ?? 5;
  const errori: Record<string, string> = {};
  const prodotto = schede.find((s) => s.codice === leggi(fd, "prodotto"));
  if (!prodotto) errori.prodotto = "Scelga il prodotto";
  const quantita = Number(leggi(fd, "quantita"));
  if (!Number.isInteger(quantita) || quantita < 1 || quantita > massimo) errori.quantita = `Da 1 a ${massimo} confezioni`;
  const note = leggi(fd, "note");
  if (note.length > 1000) errori.note = "Massimo 1000 caratteri";
  if (Object.keys(errori).length || !medico || !prodotto) return { errori, valori, messaggio: "Controlli i campi evidenziati." };

  // Una sola richiesta in corso per prodotto
  const { count } = await db
    .from("richieste_campioni")
    .select("id", { count: "exact", head: true })
    .eq("medico_id", utente.medicoId)
    .eq("prodotto_codice", prodotto.codice)
    .in("stato", ["nuova", "in_lavorazione"]);
  if (count) return { valori, messaggio: `Ha già una richiesta in corso per ${prodotto.nome}: attenda che venga gestita.` };

  const { data: richiesta, error } = await db
    .from("richieste_campioni")
    .insert({
      medico_id: utente.medicoId,
      prodotto_codice: prodotto.codice,
      prodotto_nome: prodotto.nome,
      quantita,
      note: note || null,
      spedizione: indirizzoMedico(medico),
    })
    .select("id")
    .single();
  if (error || !richiesta) {
    console.error("[campioni] richiesta non salvata:", error?.message);
    return { valori, messaggio: "Invio non riuscito. Riprovi tra poco." };
  }

  await emailAmministrazione().then((a) =>
    inviaEmail(emailNuovaRichiestaCampioniAdmin(a, medico, { id: richiesta.id, prodotto_nome: prodotto.nome, quantita, note: note || null })),
  );
  revalidatePath("/medici/campioni");
  return { ok: true, messaggio: `Richiesta inviata: ${quantita} ${quantita === 1 ? "confezione" : "confezioni"} di ${prodotto.nome}. La avviseremo via email.` };
}
