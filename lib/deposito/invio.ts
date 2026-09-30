import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { excelRichiestaEvasione, pdfRichiestaEvasione, type DatiDeposito } from "@/lib/documents/richiesta-evasione";
import { inviaEmail, type Allegato } from "@/lib/email/invia";
import { emailCambioStato, emailRichiestaEvasione } from "@/lib/email/modelli-ordini";
import { leggiOrdine, type Ordine } from "@/lib/ordini/lettura";

// Invio degli ordini confermati al deposito di partenza (docs/DEPOSITO_E_SPEDIZIONI.md §1):
// un'email per deposito agli indirizzi della sede (più quelli in copia), con PDF + Excel per ogni ordine.
// Solo se l'email parte gli ordini passano a "Inviato al deposito".

export type EsitoInvio = { inviati: string[]; errori: string[] };

export async function inviaOrdiniAlDeposito(
  db: SupabaseClient,
  ordiniIds: string[],
  opzioni: { modalita: "singola" | "cumulativa"; utente: string | null },
): Promise<EsitoInvio> {
  const esito: EsitoInvio = { inviati: [], errori: [] };
  const { data: imp } = await db.from("impostazioni").select("prezzi_in_richiesta_evasione").single();
  const conPrezzi = Boolean(imp?.prezzi_in_richiesta_evasione);

  const ordini = (await Promise.all(ordiniIds.map((id) => leggiOrdine(db, id)))).filter((o): o is Ordine => !!o);
  // Privati con bonifico anticipato: al deposito solo dopo il pagamento ricevuto (docs/AREA_PRIVATI.md §6)
  const attesaPagamento = (o: Ordine) => o.canale === "privati" && o.snapshot_pagamento.richiede_iban && !o.pagamento_ricevuto_il;
  const pronti = ordini.filter((o) => (o.stato === "confermato" || o.stato === "modificato") && !attesaPagamento(o));
  for (const o of ordini.filter((x) => !pronti.includes(x))) {
    esito.errori.push(`${o.numero}: ${attesaPagamento(o) ? "in attesa del pagamento con bonifico" : "non è confermato"}`);
  }

  for (const [depositoId, gruppo] of Map.groupBy(pronti, (o) => o.deposito_id)) {
    const { data: sede } = await db
      .from("sedi")
      .select("nome, indirizzo, cap, citta, provincia, email, email_cc, operatore:operatore_id(ragione_sociale)")
      .eq("id", depositoId)
      .single();
    if (!sede?.email) {
      esito.errori.push(`${gruppo.map((o) => o.numero).join(", ")}: il deposito non ha un indirizzo email`);
      continue;
    }
    const deposito: DatiDeposito = {
      nome: sede.nome,
      indirizzo: `${sede.indirizzo} – ${sede.cap ?? ""} ${sede.citta ?? ""} (${sede.provincia ?? ""})`,
      operatore: (sede.operatore as unknown as { ragione_sociale: string } | null)?.ragione_sociale ?? null,
    };

    const allegati: Allegato[] = [];
    for (const o of gruppo) {
      allegati.push({ nome: `richiesta-evasione-${o.numero}.pdf`, contenuto: await pdfRichiestaEvasione(o, deposito, conPrezzi), tipo: "application/pdf" });
      allegati.push({
        nome: `richiesta-evasione-${o.numero}.xlsx`,
        contenuto: await excelRichiestaEvasione(o, deposito, conPrezzi),
        tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    }

    const cc = (sede.email_cc as string[]) ?? [];
    const partita = await inviaEmail(emailRichiestaEvasione([sede.email], cc, sede.nome, gruppo, allegati));
    const { data: invio } = await db
      .from("invii_deposito")
      .insert({
        deposito_id: depositoId,
        modalita: opzioni.modalita,
        destinatari: [sede.email, ...cc],
        ordini: gruppo.map((o) => o.id),
        esito: partita ? "inviato" : "errore",
        errore: partita ? null : "Invio email non riuscito",
        utente: opzioni.utente,
      })
      .select("id")
      .single();
    if (!partita) {
      esito.errori.push(`${gruppo.map((o) => o.numero).join(", ")}: email al deposito non partita, riprova`);
      continue;
    }

    const adesso = new Date().toISOString();
    for (const o of gruppo) {
      await db.from("ordini").update({ stato: "inviato_deposito", inviato_deposito_il: adesso, invio_deposito_id: invio?.id }).eq("id", o.id);
      await db.from("storico_stati").insert({
        ordine_id: o.id,
        da: o.stato,
        a: "inviato_deposito",
        utente: opzioni.utente,
        messaggio: `Richiesta di evasione inviata a ${sede.nome}${opzioni.modalita === "cumulativa" ? " (invio cumulativo)" : ""}`,
      });
      const aggiornato = await leggiOrdine(db, o.id);
      if (aggiornato) await inviaEmail(emailCambioStato(aggiornato, null));
      esito.inviati.push(o.numero);
    }
  }
  return esito;
}
