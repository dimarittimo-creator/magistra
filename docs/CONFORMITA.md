# Conformità e sicurezza

## GDPR
- Dati ospitati in UE (Supabase Frankfurt; funzioni Vercel in regione UE).
- Consensi separati e versionati (privacy, condizioni di vendita, eventuale marketing), con data e IP.
- Informativa privacy e condizioni di vendita (farmacie e privati, separate) come pagine modificabili dall'admin; i testi legali li fornisce il gruppo (usa segnaposto evidenti finché mancano).
- Titolari del trattamento: Sagè Pharma e Bioeleva (da chiarire con il consulente privacy se contitolari o titolare + responsabile); l'informativa deve indicarlo.
- Conversazioni del chatbot conservate per un periodo configurabile (default 24 mesi), poi cancellate.
- Registro dei fornitori che trattano dati (Supabase, Vercel, Brevo, Anthropic) in `docs/FORNITORI_DATI.md`, per le nomine a responsabile del trattamento.
- Export dei dati di una farmacia su richiesta; cancellazione account.

## Chatbot
- All'apertura: informativa GDPR e indicazione chiara che si parla con un **assistente di intelligenza artificiale** (obbligo di trasparenza AI Act).
- Informazioni sui prodotti **solo** dalla base di conoscenza approvata da Sagè Pharma, coerenti con quanto notificato al Ministero della Salute e con i claim consentiti (Reg. CE 1924/2006). Nessun claim nuovo generato dal modello.
- Nessun consiglio medico su singoli pazienti: rimanda al medico.
- Mai inventare disponibilità, prezzi o stati d'ordine: solo dagli strumenti collegati al database.

## Tutela del consumatore (area Privati)
- Verso i privati si applica il Codice del Consumo (D.Lgs. 206/2005): informazioni precontrattuali (identità e dati del venditore, prezzo totale con spese, pagamento, consegna), diritto di recesso di norma entro 14 giorni, passaggio del rischio del trasporto al consumatore solo alla consegna, garanzia legale.
- Per gli integratori sigillati aperti dopo la consegna esistono eccezioni al recesso (beni non restituibili per motivi igienici o di tutela della salute).
- Quindi: le clausole B2B "nessun reso" e "merce a rischio dell'acquirente" **non** vanno copiate nelle condizioni privati. L'area Privati resta **non attivabile online** finché il gruppo non fornisce condizioni di vendita privati validate da un legale e i valori delle spese di spedizione.
- Pagina "Chi siamo / dati del venditore" con i dati di entrambe le società, richiamata nel carrello.

## Documenti
- Il portale non emette documenti fiscali. Il DDT simulato riporta sempre la dicitura "Documento non valido ai fini fiscali – prenotazione non vincolante".

## Sicurezza
- HTTPS ovunque; password gestite da Supabase Auth (hash); Row Level Security: ogni farmacia vede solo i propri dati.
- Area admin protetta da ruolo; autenticazione a due fattori per gli admin (consigliata).
- Limiti di frequenza su login, registrazione e chatbot.
- Backup giornalieri del database; prova di ripristino prima della messa online.
- Registro operazioni admin non modificabile dall'interfaccia.
