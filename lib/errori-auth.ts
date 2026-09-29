// Messaggi in italiano per gli errori di Supabase Auth.
type ErroreAuth = { code?: string; message?: string; status?: number } | null | undefined;

export function messaggioErroreAuth(errore: ErroreAuth): string {
  switch (errore?.code) {
    case "invalid_credentials":
      return "Email o password non corretti.";
    case "email_not_confirmed":
      return "Non hai ancora confermato il tuo indirizzo email. Apri il link che ti abbiamo inviato.";
    case "user_already_exists":
    case "email_exists":
      return "Esiste già un account con questa email. Accedi oppure recupera la password.";
    case "weak_password":
      return "La password è troppo debole: usa almeno 8 caratteri con lettere e numeri.";
    case "same_password":
      return "La nuova password deve essere diversa da quella attuale.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Troppi tentativi ravvicinati. Attendi qualche minuto e riprova.";
    case "otp_expired":
      return "Il link è scaduto o è già stato usato. Richiedine uno nuovo.";
    case "user_banned":
      return "L'account non è attivo. Contatta l'amministrazione Magistra.";
    default:
      return "Operazione non riuscita. Riprova tra poco; se il problema continua contatta l'amministrazione Magistra.";
  }
}
