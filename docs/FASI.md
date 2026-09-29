# Fasi di sviluppo

A fine fase: test verdi, sito avviato in locale, istruzioni a Salvatore su cosa provare, aggiornamento di `docs/STATO_LAVORI.md`, attesa del suo ok.

## Fase 0 – Preparazione
- Verifica strumenti sul computer (Node, Git, Docker per Supabase locale); se mancano, guida Salvatore all'installazione.
- Progetto Next.js, Tailwind con i token di `GRAFICA.md`, Supabase locale, schema iniziale (comprese `societa` e `sedi` con i dati di `SOCIETA_E_SEDI.md`), repository Git.
- Layout base con intestazione Magistra, home con scelta "Farmacie" / "Privati", pagina di prova.
**Accettazione:** il sito si apre in locale con intestazione Magistra e colori corretti; nel database ci sono le due società (con i rispettivi IBAN), le quattro sedi iniziali e l'operatore logistico CIENNE collegato al deposito predefinito; pulsanti in blu Magistra; intestazione con logo Magistra e pay off "Semplicemente Magistrale".

## Fase 1 – Registrazione e accesso
- Registrazione farmacia con tutti i dati, validazione partita IVA e codice fiscale, consensi versionati.
- Stato "in attesa" fino ad approvazione; email alla farmacia e all'admin.
- Login, logout, recupero password; profilo modificabile.
- Admin: elenco iscrizioni, approva / blocca, assegna gruppo e società predefinita.
- Admin: pagine **Società** e **Sedi e depositi** (modifica dati, storico, sedi attive/disattive).
- Utente admin iniziale creato da script.
**Accettazione:** una farmacia si iscrive, non vede prezzi; l'admin la approva; la farmacia entra e vede l'area riservata. L'admin modifica un dato di una società e lo ritrova nello storico.

## Fase 2 – Catalogo e prenotazione farmacie
- Import iniziale dei file in `dati/` sul deposito predefinito (anche solo da script, l'interfaccia admin arriva in fase 3).
- `lib/pricing` e `lib/availability` con test su `dati/verifica_prezzi_attesi.xlsx`.
- Catalogo, filtri, scheda prodotto con lotti e 4 prezzi, badge di stato.
- Carrello con **società che fattura e consegna**, **modalità di pagamento obbligatoria**, consegna indicativa (5 giorni), accettazione obbligatoria delle **condizioni di vendita farmacie** (nessun reso, merce a rischio dell'acquirente); riepilogo, invio con impegno transazionale, stati, email, storico, ripeti ordine, scadenza prenotazioni.
**Accettazione:** due farmacie che ordinano insieme l'ultima merce: una sola passa. I prezzi coincidono con il file di verifica. Un ordine senza pagamento o senza accettazione delle condizioni non parte. Scegliendo Bioeleva, riepilogo ed email riportano i dati Bioeleva.

## Fase 3 – Amministrazione
- Import/export Excel (formato deposito Crystal, listino, modello pulito) con anteprima, errori e scelta del deposito.
- Pannello sconti per scadenza (come `design/riferimento_pannello_sconti.html`), IVA, sconti sul lotto.
- Pagine condizioni di vendita (versioni), modalità di pagamento (per canale, limitazioni per farmacia/gruppo), impostazioni (giorni di consegna indicativi).
- Ordini: conferma, modifica (anche cambio società prima dell'invio al deposito), rifiuto con messaggio; export.
- **Spedizioni al deposito** (`DEPOSITO_E_SPEDIZIONI.md`): invio email al deposito di partenza, singolo/cumulativo, registrazione DDT, differenze, sollecito, DDT da fatturare per società, valore distribuito mensile per società e deposito.
- Gruppi e listini dedicati; promozioni con calendario e duplica; cruscotto con filtro società/canale; registro operazioni.
**Accettazione:** importo la giacenza di esempio e vedo ELIVID mancante temporaneamente; confermo un ordine, parte l'email all'indirizzo del deposito, registro il DDT e la farmacia lo vede; l'elenco DDT da fatturare si separa tra Sagè Pharma e Bioeleva.

## Fase 4 – Documenti
- Export ordine Excel e PDF con dati fiscali del cliente e della società emittente (con logo, o segnaposto per Bioeleva).
- DDT simulato con mittente = società scelta, luogo di partenza = deposito, condizioni di vendita e dicitura "Documento non valido ai fini fiscali – prenotazione non vincolante".
- Download del DDT reale dopo la spedizione.
**Accettazione:** i totali di PDF ed Excel coincidono al centesimo con il riepilogo dell'ordine; cambiando società cambiano intestazione e dati fiscali.

## Fase 5 – Area Privati (B2C)
Tutto come in `AREA_PRIVATI.md`:
- registrazione e accesso privati; negozio con prezzo pieno, sconto del mese e prezzo finale IVA inclusa;
- pannello sconti privati del mese (globale, linea, prodotto), "copia sul mese successivo", promemoria di fine mese;
- assegnazione automatica del lotto (soglia minima di vita residua);
- spese di spedizione configurabili (per ora vuote); pagamento obbligatorio; condizioni privati separate;
- ordini privati nel flusso ordini/deposito, con "pagamento ricevuto" per il bonifico;
- blocco di attivazione online finché mancano spese di spedizione e condizioni privati validate.
**Accettazione:** un privato si registra, vede lo sconto del mese, ordina con la spedizione calcolata; a cambio mese lo sconto scade da solo; l'admin non riesce ad attivare l'area online senza spese e condizioni.

## Fase 6 – Chatbot
- Base di conoscenza caricata e approvata dal gruppo; ricerca su pgvector.
- Strumenti: disponibilità e lotti, promozioni, stato ordini del cliente collegato, proposta di aggiunta al carrello **con conferma esplicita**.
- Risponde anche su condizioni di vendita, tempi di consegna indicativi, modalità di pagamento e società che fattura, leggendoli dal database.
- Passaggio a operatore (email + pannello, risposta nella stessa chat); domande senza risposta; storico.
- Informativa GDPR e dichiarazione che si tratta di un assistente AI all'apertura.
- Architettura pronta per una versione vocale (base di conoscenza separata dal canale).
**Accettazione:** il chatbot non inventa prodotti o dati, non dà consigli su singoli pazienti, chiede conferma prima del carrello.

## Fase 7 – Messa online
- Progetto Supabase EU e Vercel di produzione (con Salvatore, passo passo).
- Collegamento del dominio registrato su Aruba (istruzioni DNS precise).
- Email Brevo autenticata sul dominio (SPF, DKIM).
- Backup, controllo sicurezza, prova con 2-3 farmacie.
- Area Privati attivata solo quando sono pronti spese di spedizione e condizioni privati validate.
