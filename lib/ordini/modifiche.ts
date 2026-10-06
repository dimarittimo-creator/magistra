import "server-only";
import { emailAmministrazione } from "@/lib/email/destinatari";
import { inviaEmail } from "@/lib/email/invia";
import { emailRispostaModificheAdmin } from "@/lib/email/modelli-ordini";
import { leggiOrdine } from "@/lib/ordini/lettura";
import { creaClientAdmin } from "@/lib/supabase/admin";

// Condizioni di vendita art. 4.3: risposta del cliente (farmacia o privato) alle modifiche dell'amministrazione.
// Il chiamante ha già verificato che l'ordine appartenga al cliente collegato.
export async function rispondiModifiche(ordineId: string, utenteId: string, accetta: boolean): Promise<{ ok: boolean; messaggio: string }> {
  const admin = creaClientAdmin();
  const { data, error } = await admin.rpc("rispondi_modifiche_ordine", { p_ordine: ordineId, p_utente: utenteId, p_accetta: accetta });
  if (error) {
    console.error("[ordine] risposta alle modifiche non salvata:", error.message);
    return { ok: false, messaggio: "Operazione non riuscita. Riprova tra poco." };
  }
  if (data.esito !== "ok") return { ok: false, messaggio: "Questo ordine non ha modifiche in attesa di risposta." };

  const ordine = await leggiOrdine(admin, ordineId);
  if (ordine) await inviaEmail(emailRispostaModificheAdmin(await emailAmministrazione(), ordine, accetta));
  return {
    ok: true,
    messaggio: accetta
      ? "Grazie: hai accettato le modifiche. L'ordine prosegue e sarà preparato dal deposito."
      : "Hai rifiutato le modifiche: l'ordine è stato chiuso e non verrà spedito.",
  };
}
