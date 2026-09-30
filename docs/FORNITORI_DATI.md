# Fornitori che trattano dati per Magistra

Registro dei servizi esterni che ricevono dati personali o commerciali del portale (docs/CONFORMITA.md, GDPR).
Serve al consulente privacy per le **nomine a responsabile del trattamento** (art. 28 GDPR) e per l'informativa.
Titolari: Sagè Pharma S.r.l. e Bioeleva S.r.l. (ruolo esatto da definire con il consulente).

_Da aggiornare quando si aggiunge o si cambia un fornitore. Condizioni e sedi vanno ricontrollate sul sito del fornitore al momento della firma._

| Fornitore | Servizio | Dati trattati | Dove | Documento da firmare/accettare |
|---|---|---|---|---|
| **Supabase** | Database, autenticazione, archivio file (documenti d'ordine, DDT) | Tutti i dati del portale: account, farmacie, clienti privati, ordini, consensi, chat dell'assistente | UE – Francoforte (progetto da creare in regione EU) | Data Processing Addendum di Supabase |
| **Vercel** | Hosting del sito e job pianificati | Dati in transito nelle richieste; registri tecnici (indirizzi IP) | Funzioni in regione UE (`fra1`); rete di distribuzione globale | Data Processing Addendum di Vercel |
| **Brevo** | Invio delle email del portale | Indirizzi email, nomi, contenuto delle email (riepiloghi d'ordine, avvisi) | UE (Francia) | Data Processing Agreement di Brevo |
| **Anthropic** | Modello di intelligenza artificiale dell'assistente (Claude) | Testo dei messaggi della chat e dati letti dagli strumenti per rispondere (catalogo, prezzi, promozioni, ordini della farmacia collegata, testi della base di conoscenza). Non riceve password né dati di pagamento. | Stati Uniti (trasferimento extra UE: clausole contrattuali standard previste dalle condizioni commerciali di Anthropic) | Condizioni commerciali e Data Processing Addendum di Anthropic |
| Voyage AI (facoltativo, **non attivo**) | Ricerca "per significato" nella base di conoscenza | Solo i testi della base di conoscenza e le domande della chat | Da verificare prima dell'eventuale attivazione | Da valutare solo se si decide di attivarlo |

## Note sull'assistente (chatbot)
- All'apertura della chat la farmacia vede l'informativa e la dichiarazione che parla con un'intelligenza artificiale, con il nome del fornitore (Anthropic).
- Si chiede di **non inserire dati sanitari dei pazienti**; l'assistente non li chiede.
- Le conversazioni restano nel database di Magistra per il periodo impostato (predefinito 24 mesi, Admin → Impostazioni) e poi si cancellano da sole; lo stesso vale per le domande senza risposta.
- In locale e nei test l'assistente usa una "modalità di prova" che non invia nulla ad Anthropic.
- L'**informativa privacy** definitiva deve citare la chat, le finalità (assistenza nella consultazione e negli ordini), il fornitore Anthropic e il periodo di conservazione.

## Solo sviluppo (nessun dato reale)
- **Mailpit** (casella email di prova sul computer di sviluppo) e **Supabase locale** (Docker): girano solo sul computer, non in produzione.
