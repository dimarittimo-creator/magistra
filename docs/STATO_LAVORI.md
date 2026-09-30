# Stato lavori

_Aggiornato da Claude Code a fine di ogni sessione._

- [x] Fase 0 – Preparazione — **completata** (29/09/2026): Node.js, Git, WSL e Docker Desktop installati; database locale avviato con le due società (con IBAN), le quattro sedi e l'operatore CIENNE collegato al deposito predefinito; test verdi.
- [x] Fase 1 – Registrazione, accesso, società e sedi — **completata** e approvata (29/09/2026).
- [x] Fase 2 – Catalogo e prenotazione farmacie — **completata** e approvata (29/09/2026).
- [x] Fase 3 – Amministrazione e spedizioni al deposito — **completata** e approvata (29/09/2026).
- [x] Fase 4 – Documenti — **completata** e approvata (30/09/2026).
- [x] Fase 5 – Area Privati (B2C) — **completata** e approvata (30/09/2026). Online resta **non attivabile** finché mancano spese di spedizione e condizioni privati validate.
- [x] Fase 6 – Chatbot — **completata** e approvata (30/09/2026): test verdi (114 Vitest, 30 Playwright). Per usare l'intelligenza artificiale vera serve la chiave Anthropic (a pagamento): senza, in locale funziona la modalità di prova.
- [ ] Fase 7 – Messa online — **in corso** (dal 30/09/2026)

## Fase 0 – cosa c'è
- Next.js + TypeScript + Tailwind con i token colore di `GRAFICA.md` (chiaro e scuro) in `app/globals.css`; caratteri Tinos e Public Sans.
- Loghi ricavati da `design/logo_magistra.jpg` in `public/brand/` (script `scripts/prepara-loghi.ps1`); favicon con la stellina rame.
- Intestazione (logo + "Sagè Pharma · Bioeleva", versione compatta su smartphone), home con scelta Farmacie / Privati, pagina di prova `/prova` (solo in locale).
- Database: migrazione `supabase/migrations/20260929090000_schema_iniziale.sql` (società con storico, sedi, operatori logistici, impostazioni, profili e ruoli, registro operazioni non modificabile, RLS attiva, controlli IBAN e partita IVA). Dati iniziali in `supabase/seed.sql`; IBAN in `supabase/seed_privato.sql` (fuori dal repository).
- Test Vitest: `tests/unit/validazione.test.ts`.

### Come provarlo (dopo le installazioni)
1. `npm install`
2. `npm run db:start` (Docker Desktop deve essere aperto) e poi `npm run db:env`
3. `npm run dev` → http://localhost:3000 e http://localhost:3000/prova
4. Pannello del database locale (Supabase Studio): http://localhost:54323

## Fase 1 – cosa c'è
- **Iscrizione farmacia** (`/registrazione`): tutti i dati della specifica, controllo di partita IVA, codice fiscale (11 o 16 caratteri), SDI o PEC, CAP e provincia; indirizzo di fatturazione "uguale alla consegna"; consensi privacy e condizioni di vendita obbligatori, marketing facoltativo, salvati con versione, data e IP. Codice farmacia progressivo assegnato dal portale (da 0100).
- **Conferma email** obbligatoria prima del primo accesso (email in italiano, link valido 1 ora, "invia di nuovo" dalla pagina di accesso).
- **Stato "in attesa"** finché l'admin non approva: la farmacia entra ma non vede prezzi né disponibilità. Email alla farmacia (richiesta ricevuta, approvata, bloccata) e all'amministrazione (nuova iscrizione).
- **Accesso, uscita, recupero password** (`/accesso`, `/recupero-password`, `/nuova-password`).
- **Area farmacia** (`/farmacia`): stato dell'iscrizione e riepilogo dati; **profilo** (`/farmacia/profilo`) con recapiti e indirizzi modificabili (ragione sociale, P.IVA e codice fiscale solo dall'admin; codice farmacia fisso), cambio password, consenso marketing revocabile.
- **Amministrazione** (`/admin`): cruscotto con iscrizioni da approvare; **farmacie** con filtri e ricerca, scheda con approva / rifiuta / blocca / riattiva, gruppo, società predefinita, note interne, correzione dati, consensi, conferma email, storico; **gruppi**; **società** (modifica con controllo IBAN, una sola predefinita, storico); **sedi e depositi** (nuova sede, modifica, attiva/disattiva, deposito predefinito, operatore logistico, email in copia, storico); **registro operazioni**.
- L'operatore vede cruscotto ed elenco farmacie, senza poterle modificare.
- **Testi legali** con versioni (`/privacy`, `/condizioni/farmacie`, `/condizioni/privati`): per ora **testi provvisori** evidenziati in giallo.
- **Sicurezza**: la farmacia vede e modifica solo i propri dati (RLS); un trigger impedisce che cambi da sola stato, gruppo, società o dati identificativi; registro e storico non modificabili.
- Database: migrazione `supabase/migrations/20260929120000_fase1_farmacie_accesso.sql`. Modelli email in `supabase/templates/`.
- Test: `tests/unit/validazione.test.ts` (Vitest) e `tests/e2e/fase1.spec.ts` (Playwright con Microsoft Edge).

### Come provarlo
1. Docker Desktop aperto, poi `npm run db:start`, `npm run db:env`, `npm run db:utenti-test` (crea gli utenti di prova e scrive le password in `credenziali-test.txt`).
2. `npm run dev` → http://localhost:3000
3. Email ricevute dal portale (casella di prova): http://127.0.0.1:54324
4. Test automatici: `npm test` e `npm run test:e2e` (il sito deve essere avviato o si avvia da solo).
5. Amministratore vero per la messa online: `npm run crea-admin -- email "Nome Cognome"`.

## Fase 6 – cosa c'è
- **Assistente nell'area farmacia**: pulsante «Assistente» sempre visibile in basso a destra (anche da tablet e telefono). All'apertura: **informativa** (conservazione, fornitore Anthropic, niente dati dei pazienti, link alla privacy) e dichiarazione chiara che si parla con un **assistente di intelligenza artificiale**; si inizia solo dopo «Ho letto».
- **Risposte dai dati veri**, letti in tempo reale con i permessi della farmacia: ricerca prodotti, disponibilità, lotti, scadenze, sconti e prezzi farmacia, promozioni attive per quella farmacia, stato dei suoi ordini (con spedizione e link a documenti e DDT), condizioni di vendita, validità della prenotazione, tempi di consegna indicativi, modalità di pagamento consentite, società che fattura.
- **Carrello con conferma esplicita**: l'assistente prepara una proposta (prodotto, lotto, scadenza, quantità) con i pulsanti **Conferma** / **Annulla**; solo «Conferma» mette la merce nel carrello, con gli stessi controlli del catalogo. "Il lotto con lo sconto migliore" = prezzo farmacia più basso.
- **Base di conoscenza** (Admin → Assistente → Base di conoscenza, solo admin): schede prodotto, FAQ e documenti (testo incollato o file PDF/TXT/MD), destinatari (farmacie, privati, tutti; «medici» predisposto). L'assistente usa **solo i documenti approvati**; se un testo approvato viene modificato torna in bozza. Ricerca per parole in italiano; ricerca "per significato" (pgvector) già predisposta, si attiva con un servizio di embedding.
- **Regole di comportamento**: niente prodotti, prezzi o stati inventati; informazioni sui prodotti solo dalla base di conoscenza, senza claim nuovi; nessun consiglio sul singolo paziente (rimanda al medico); se non sa, lo dice, **registra la domanda** e propone l'operatore.
- **Passaggio a operatore** (pulsante o su richiesta): avviso email a tutti gli admin; nel pannello **Admin → Assistente** si vedono richieste aperte e storico; la risposta compare **nella stessa chat** e la farmacia riceve un'email. Chiudendo la richiesta le domande successive tornano all'assistente, che vede anche la risposta dell'operatore. Anche l'operatore (ruolo) può rispondere.
- **Domande senza risposta** (Admin → Assistente → Domande senza risposta) da valutare, risolvere o ignorare.
- **Conservazione**: le conversazioni si cancellano da sole dopo i mesi indicati in Impostazioni (predefinito 24). **Limiti**: 15 messaggi in 5 minuti, 200 al giorno per utente.
- **Senza chiave Anthropic**: in locale «modalità di prova» (risposte simulate con parole chiave, stessi strumenti, gratis, segnalata in giallo nella chat); online le domande vanno direttamente a un operatore.
- Registro dei fornitori di dati: `docs/FORNITORI_DATI.md` (Supabase, Vercel, Brevo, Anthropic).
- Database: `20261001090000_fase6_chatbot.sql`; FAQ di esempio sull'uso del portale in `supabase/seed.sql`.
- Test: `tests/unit/chat.test.ts`, `tests/e2e/fase6.spec.ts`.

### Come provarlo (in locale, modalità di prova)
1. Accedi come **farmacia.attiva@magistra.test** (password in `credenziali-test.txt`) → pulsante **Assistente** in basso a destra → leggi l'informativa → **Ho letto, inizia**.
2. Prova frasi come: «disponibilità del prodotto 923813695» (NEUROPROTEX 15 CPR), «aggiungi 10 pezzi del prodotto 923813695» → **Conferma** → il carrello nel menu si aggiorna; «quali promozioni ci sono?», «a che punto è l'ordine P-2026-00052?», «come posso pagare?», «dove scarico il DDT?».
3. Premi **Parla con un operatore**; come **admin@magistra.test** vai in **Assistente**, apri la richiesta e rispondi: la risposta compare nella chat della farmacia (email su http://127.0.0.1:54324).
4. In **Assistente → Base di conoscenza** crea un documento, poi **Approva**: da quel momento l'assistente lo usa.
In modalità di prova le risposte sono semplici e riconoscono solo alcune parole: con la chiave Anthropic l'assistente capisce frasi libere e risponde in modo naturale.

### Da fornire / decidere
- **Chiave Anthropic** (servizio a pagamento, costo a consumo): da creare su console.anthropic.com con i dati dell'azienda e da inserire in `.env.local` (`ANTHROPIC_API_KEY`); online si inserisce su Vercel in Fase 7.
- **Contenuti della base di conoscenza**: schede prodotto (composizione, formato, modo d'uso, avvertenze) e FAQ approvate dal gruppo, coerenti con le notifiche al Ministero.
- **Informativa privacy** definitiva: deve citare la chat, il fornitore Anthropic e la conservazione (vedi `docs/FORNITORI_DATI.md`).
- Facoltativo: ricerca "per significato" (Voyage AI, a pagamento) — utile quando la base di conoscenza sarà ampia.
- Assistente per i clienti privati: l'architettura è pronta, oggi è attivo solo per le farmacie.

## Fase 5 – cosa c'è
- **Negozio** (`/negozio`), consultabile anche senza account: prezzo pieno, **sconto del mese**, prezzo finale IVA inclusa, "Disponibile / Non disponibile". Niente lotti, giacenze, prezzi o sconti farmacia (i dati arrivano dal server già filtrati, `lib/negozio.ts`). Prodotti visibili ai privati per default se hanno un prezzo (campo "Visibile nell'area Privati" nella scheda prodotto).
- **Registrazione privato** (`/registrazione/privato`): nome, cognome, codice fiscale, email, telefono, indirizzo di spedizione e fatturazione, consensi (privacy, condizioni privati, marketing facoltativo). Attivo dopo la conferma dell'email, senza approvazione. Si può creare l'account al primo ordine (niente ordini anonimi).
- **Carrello e ordine**: il cliente sceglie prodotto e quantità; il **lotto lo assegna il sistema** (scadenza più vicina tra i lotti con almeno 6 mesi di vita residua, impostabile; i lotti più corti restano alle farmacie). Società che vende (se attive entrambe), **pagamento obbligatorio** (bonifico anticipato, contrassegno; carta online predisposta ma non attiva), note, **spese di spedizione** calcolate (gratuite oltre soglia) su riga separata, condizioni privati con accettazione obbligatoria. Il totale è la somma dei prezzi mostrati; IVA per scorporo. Stesso impegno transazionale delle farmacie.
- **Ordini privati** nello stesso flusso ordini/deposito; con **bonifico** l'ordine va al deposito solo dopo "**Segna pagamento ricevuto**" (anche nell'invio cumulativo). Email dedicate (ricevuto, cambi di stato) e documenti PDF/Excel con prezzi IVA inclusa e spese; niente DDT simulato per i privati.
- **Amministrazione**: **Sconti privati** del mese (globale, linea, prodotto; vale il migliore; anteprima dei prezzi finali; "Copia sul mese successivo"; scadono da soli; promemoria email 5 giorni prima della fine del mese se il mese dopo è scoperto), **Clienti privati** (blocca / sblocca), **Area Privati** (spese di spedizione, soglia gratuita, IVA sulle spese, vita residua minima dei lotti, **attivazione online bloccata** finché mancano spese e condizioni privati definitive — blocco anche nel database).
- Pagina pubblica **Chi siamo – dati del venditore** con i dati delle due società, richiamata dal carrello e dal piè di pagina.
- Database: `20260930160000_fase5_area_privati.sql`; modalità di pagamento privati in `supabase/seed.sql`.
- Test: `tests/unit/privati.test.ts`, `tests/e2e/fase5.spec.ts`.

### Come provarlo (in locale il negozio è sempre aperto)
1. Come admin: **Area Privati** → indica le spese di spedizione (valore di prova, es. 6,90 €) → Salva. Prova **Attiva online**: il portale spiega perché non si può.
2. **Sconti privati** → nuovo sconto (es. 15% su tutto il negozio per questo mese) → guarda l'anteprima → Salva.
3. Apri http://localhost:3000/negozio (anche da smartphone), accedi come **privato@magistra.test** (password in `credenziali-test.txt`) o crea un nuovo account, aggiungi prodotti, completa l'ordine.
4. Come admin, in **Ordini** conferma l'ordine; con bonifico usa "Segna pagamento ricevuto" prima di inviarlo al deposito.

### Da fornire per aprire online
- **Spese di spedizione** per i privati (importo, eventuale soglia di gratuità, eventuale costo del contrassegno).
- **Condizioni di vendita privati** validate da un legale (recesso, garanzia, ecc.): si pubblicano da **Condizioni e privacy** togliendo "provvisorio".
- Eventuale gestore dei **pagamenti con carta** (da decidere).

## Fase 4 – cosa c'è
- **Riepilogo d'ordine in PDF ed Excel** (`lib/documents/ordine.tsx`), scaricabile dalla farmacia e dall'amministrazione (pulsanti "Documenti" nel dettaglio ordine): intestazione della **società che fattura** con logo (Sagè Pharma) o Bioeleva; se una società non ha logo compare il nome, dati fiscali completi di società e cliente, righe con lotti, scadenze, prezzo al pubblico, sconto, prezzo netto e IVA, totali per aliquota, pagamento (con IBAN per il bonifico), consegna indicativa, condizioni di vendita accettate (versione dell'ordine); logo Magistra piccolo nel piè di pagina "Ordine effettuato tramite Magistra".
- **DDT simulato** in PDF: mittente = società scelta, luogo di partenza = indirizzo del deposito (senza i dati dell'operatore logistico), destinatario e luogo di destinazione, righe e totali, condizioni di vendita e la dicitura **"Documento non valido ai fini fiscali – prenotazione non vincolante"** in evidenza.
- **Dopo la spedizione** il DDT reale caricato dall'admin sostituisce il simulato tra i documenti.
- Gli importi sono quelli salvati nell'ordine: **PDF ed Excel coincidono al centesimo** con il riepilogo (test automatico, anche con due aliquote IVA). **Cambiando società** (modifica dall'admin) cambiano intestazione, dati fiscali e IBAN.
- La farmacia scarica solo i documenti dei propri ordini.
- Test: `tests/e2e/fase4.spec.ts`. Loghi nei documenti: versioni leggere `public/brand/logo-sage-pharma-documenti.jpg` e `logo-bioeleva-documenti.jpg` (logo Bioeleva aggiunto il 30/09/2026). Ordini di esempio della farmacia di prova: P-2026-00052 (Sagè Pharma) e P-2026-00064 (Bioeleva).

### Come provarlo
1. Accedi come **farmacia.attiva@magistra.test** → **I miei ordini** → apri l'ordine di esempio → **Riepilogo PDF**, **Riepilogo Excel**, **DDT simulato**.
2. Come admin, **Modifica** dell'ordine → cambia società in Bioeleva → riscarica il PDF: intestazione e dati fiscali sono quelli di Bioeleva.

## Fase 3 – cosa c'è
- **Magazzino** (`/admin/magazzino`): import di giacenza del deposito (Crystal `.xls`), listino e modello Magistra con **anteprima** (errori, difformità, lotti senza scadenza o scaduti, codici nuovi, prodotti spariti, giacenza sotto il prenotato) e conferma o annullamento; scelta del deposito e della data; export del magazzino e modello vuoto con legenda (stesso formato, si ricarica così com'è).
- **Sconti e prezzi** (`/admin/sconti`) come il riferimento grafico: fasce di scadenza modificabili (serve sempre la fascia da 0 mesi, niente mesi doppi), IVA predefinita, prezzo e IVA per prodotto, sconto sul singolo lotto; prezzi ricalcolati mentre scrivi e conteggio dei lotti che cambiano prima di salvare; storico.
- **Prodotti** (`/admin/prodotti`): nome, formato, descrizione, linea e area terapeutica (anche nuove), minimo e multiplo, soglia in esaurimento, visibilità privati, attivo; storico.
- **Impostazioni**, **Condizioni e privacy** (nuove versioni, con data di entrata in vigore; le vecchie restano), **Pagamenti** (modalità per canale, bonifico/contrassegno, **limitazioni per farmacia o gruppo** applicate a carrello e invio).
- **Ordini**: prendi in verifica, conferma, **modifica** (quantità, righe tolte, società che fattura, pagamento; merce ricontrollata con i lotti bloccati), **rifiuto con motivo** (la merce torna disponibile), export Excel; email alla farmacia a ogni cambio di stato.
- **Deposito**: richiesta di evasione **PDF + Excel** (mittente = società, deposito di partenza, destinatario, lotti e quantità, omaggi su righe separate, contrassegno in evidenza, prezzi solo se attivati) inviata all'email del deposito con le copie; modalità **singola** (pulsante sull'ordine) o **cumulativa** (all'orario impostato, job `/api/cron/deposito`); **registrazione DDT** con numero, data, corriere, tracking, colli, PDF e **differenze** riga per riga (quantità o lotto diversi); **sollecito** all'amministrazione se manca il DDT oltre le ore impostate; la farmacia vede la spedizione e **scarica il DDT**. La merce spedita dopo la data della giacenza resta sottratta finché un nuovo import non la comprende.
- **Fatturazione** (`/admin/fatturazione`): **DDT da fatturare separati per società** e canale, segno "fatturato", export Excel (DDT, righe, valore distribuito) con scadenze RIBA stimate; **valore distribuito per mese**, deposito e società con il compenso stimato dell'operatore (2% CIENNE).
- **Gruppi e listini dedicati**: per ogni gruppo prezzo al pubblico diverso e/o sconto riservato (vale il migliore con lo sconto del lotto).
- **Promozioni** (`/admin/promozioni`) con calendario, stato automatico (programmata, attiva, conclusa, sospesa) e **duplica**: sconto % (vale il migliore, mai la somma), **sconto merce** "10+2" e **omaggio** di un altro prodotto (a prezzo zero, impegnano giacenza, righe separate); per catalogo, linea, prodotto o lotto, per tutte le farmacie o un gruppo.
- **Cruscotto** con filtri per periodo, società e canale: cose da fare, ordini e imponibile del periodo, prodotti più richiesti, farmacie più attive, lotti in scadenza.
- **Registro operazioni** con tutte le nuove azioni. L'operatore gestisce ordini e spedizioni ma non impostazioni commerciali né società.
- Database: `20260930120000_fase3_amministrazione_deposito.sql`, `20260930150000_fase3_pagamenti_consentiti.sql`.
- Test: `tests/e2e/fase3-magazzino.spec.ts`, `fase3-ordini.spec.ts`, `fase3-commerciale.spec.ts`, `tests/unit/promozioni.test.ts`.

### Come provarlo
1. Accedi come **admin@magistra.test**. **Magazzino** → carica `dati/giacenza_esempio_21-09-2026.xls` → anteprima → **Applica**; in **Prodotti** ELIVID è "Mancante temporaneamente".
2. Con la farmacia di prova invia una prenotazione; da **Ordini** → **Conferma** → **Invia al deposito** (l'email con PDF ed Excel arriva nella casella di prova http://127.0.0.1:54324, non al deposito vero) → **Registra il DDT**. La farmacia vede DDT e tracking nel suo ordine.
3. **Fatturazione**: scegli Sagè Pharma o Bioeleva per vedere i DDT separati.
4. Per provare l'invio cumulativo o il sollecito senza aspettare: http://localhost:3000/api/cron/deposito (con `?cumulativo=ora` forza l'invio cumulativo, solo in locale).

### Scelte da confermare
- **Formato della richiesta di evasione**: ho proposto un formato standard (PDF + Excel); va confrontato con il file che Sagè Pharma invia oggi al deposito.
- **Scadenze RIBA** nell'export: stimate come data DDT + 30/60/90 giorni a fine mese; la data vera dipende dalla fattura.
- **Omaggi quando l'admin riduce le quantità** di un ordine: gli omaggi già calcolati restano; se servono meno omaggi vanno tolti a mano (da rivedere se capita spesso).

## Fase 2 – cosa c'è
- **Import iniziale** della giacenza di esempio (Crystal `.xls`, letta così com'è) e del listino sul deposito predefinito: `npm run importa-dati` (47 prodotti, 64 lotti, 90.297 pezzi; 8 prodotti senza prezzo restano non visibili). Lettura in `lib/import/`, scrittura in `lib/import/applica.ts`, riusabili dall'interfaccia admin della Fase 3.
- **Prezzi** in un solo modulo (`lib/pricing`): fasce di scadenza modificabili (8 mesi 38%, 6 mesi 40%, sotto 45%), "oggi + N mesi" come EDATE di Excel, sconto manuale sul lotto, predisposizione promozioni (vale il migliore), totali con IVA per aliquota. **I 64 lotti del file di verifica coincidono al centesimo** (test automatico).
- **Disponibilità e stati** (`lib/availability` + funzione `disponibilita_lotti` nel database): difformità → "Mancante temporaneamente", lotto senza scadenza → "Mancante", scaduti nascosti, "In esaurimento" sotto 50 pezzi, merce prenotata sottratta subito.
- **Catalogo** (`/farmacia/catalogo`) con ricerca, filtri linea/area (compaiono quando le linee saranno inserite) e "solo disponibili"; **scheda prodotto** con lotti, scadenze, disponibili, sconto colorato per fascia e i 4 prezzi (farmacia IVA esclusa in grassetto).
- **Carrello** salvato sul server (si ritrova da tablet o computer): quantità modificabili, controllo di disponibile, minimo e multiplo; scelta **società che fattura e consegna** (predefinita della farmacia o del portale); **modalità di pagamento obbligatoria** (bonifico solo se la società ha un IBAN valido, con IBAN mostrato); data desiderata, note, consegna indicativa (5 giorni lavorativi, non garantita); riepilogo con imponibile, sconti, IVA e totale; condizioni di vendita con **"Ho letto e accetto" obbligatorio**.
- **Invio in un'unica transazione** (`invia_ordine_farmacia`): lotti bloccati, controllo della merce, numerazione P-2026-00001, fotografia di farmacia, società, pagamento e condizioni. Se nel frattempo la merce è finita, l'ordine non parte e la farmacia vede quale riga correggere.
- **Email**: riepilogo alla farmacia (con dati della società scelta, IBAN per il bonifico, condizioni accettate) e avviso all'amministrazione.
- **I miei ordini** con stato, dettaglio, storico e **"Ripeti ordine"** (se il lotto è finito propone il lotto con il prezzo migliore).
- **Scadenza delle prenotazioni** non confermate entro 3 giorni lavorativi (festività nazionali escluse): job `/api/cron/scadenze` ogni 15 minuti (`vercel.json`), la merce torna disponibile, email alla farmacia.
- **Amministrazione → Ordini**: elenco e dettaglio in sola lettura (conferma, modifica, rifiuto e invio al deposito in Fase 3).
- Database: migrazione `supabase/migrations/20260930090000_fase2_catalogo_ordini.sql`; fasce e modalità di pagamento iniziali in `supabase/seed.sql`.
- Test: `tests/unit/pricing.test.ts`, `tests/unit/import.test.ts`, `tests/e2e/fase2.spec.ts` (Bioeleva nel riepilogo e nell'email, invio bloccato senza pagamento o condizioni, due farmacie sull'ultima merce, scadenza e ripeti ordine, farmacia in attesa senza catalogo).

### Come provarlo
1. Come per la Fase 1, poi `npm run importa-dati` (solo la prima volta o dopo un `npm run db:reset`).
2. Accedi come **farmacia.attiva@magistra.test** (password in `credenziali-test.txt`) → Catalogo → un prodotto → Aggiungi → Carrello → Invia.
3. Le email arrivano su http://127.0.0.1:54324; l'admin vede la prenotazione in Amministrazione → Ordini.
4. Per provare la scadenza senza aspettare 3 giorni: http://localhost:3000/api/cron/scadenze esegue il controllo (in locale non serve la chiave).

### Da sapere per la messa online
- Il job ogni 15 minuti su Vercel richiede il piano Pro; con il piano gratuito si può eseguire una volta al giorno.

## Decisioni del 30/09/2026 (Fase 7)
- **Dominio**: magistraonline.it (registrato su Aruba). Indirizzo del portale **https://www.magistraonline.it**; magistraonline.it senza "www" rimanda lì. Email del portale inviate da **noreply@magistraonline.it**, dominio autenticato con SPF e DKIM. **Servizio email da decidere**: Delera se offre SMTP transazionale (dominio proprio, SPF/DKIM, allegati PDF), altrimenti Brevo per le email automatiche e Delera per il marketing.
- **Codice su GitHub**: repository privato `dimarittimo-creator/magistra` (dal 30/09/2026). IBAN reali tolti anche dalla cronologia (sostituiti da "IBAN-RIMOSSO"): i test li leggono dal database.
- **Database di produzione**: Supabase Pro, progetto `magistra` a **Francoforte** (eu-central-1, ref `lepykbcqppnqrintlcmu`), creato il 30/09/2026. Caricate le 8 migrazioni e i dati iniziali (società con IBAN, sedi, CIENNE, fasce, pagamenti, testi legali provvisori). Nessun prodotto né utente: magazzino da importare dal sito, primo admin con `npm run crea-admin`.
- **Sito di produzione**: Vercel Pro, team `sage-pharma`, progetto `magistra` collegato al repository GitHub (ogni aggiornamento di `main` si pubblica da solo), regione `fra1`. Variabili impostate: indirizzo e chiavi Supabase, `CRON_SECRET`. Da aggiungere: `NEXT_PUBLIC_SITE_URL`, email, Anthropic.
- **Costi approvati** da Salvatore: Supabase Pro (circa 25 $/mese) e Vercel Pro (circa 20 $/mese).
- **Dati iniziali di produzione**: `supabase/seed.sql` + `supabase/seed_privato.sql` (IBAN, fuori da Git). Gli esempi di prova stanno in `supabase/seed_esempi_locale.sql` e non vanno online.

## Decisioni del 29/09/2026 (Fase 1)
- **Codice farmacia**: lo assegna il portale all'iscrizione, numero progressivo da **0100** in avanti; la farmacia non lo inserisce e non si modifica (migrazione `20260929140000_codice_farmacia_progressivo.sql`).
- **Avvisi di nuova iscrizione**: a tutti gli utenti admin.

## Punti da chiarire (emersi in Fase 1)
- Informativa privacy e condizioni di vendita definitive: sostituiscono i testi provvisori creando una nuova versione (pagina admin in Fase 3).

## Punti da chiarire (emersi in Fase 0)
- ~~Possibile centesimo di differenza tra il file di verifica e le regole di arrotondamento~~ — **risolto in Fase 2**: con le regole di `REGOLE_COMMERCIALI.md` tutti i 64 lotti coincidono al centesimo.
- Nello stesso file la data di riferimento è una formula "oggi": i valori salvati devono essere quelli del 28/09/2026.

## Modifiche alle specifiche
- 28/09/2026 (v2): progetto rinominato Magistra; scelta società che fattura e consegna (Sagè Pharma / Bioeleva); sedi operative e depositi; condizioni di vendita farmacie (nessun reso, merce a rischio dell'acquirente, consegna indicativa entro 5 giorni); pagamento obbligatorio nell'ordine; nuova area Privati con sconti mensili e spese di spedizione.
- 29/09/2026 (v3): progetto rinominato **Magistra**, pay off "Semplicemente Magistrale", logo in `design/logo_magistra.jpg` con colori `magistra-blu` e `magistra-rame`; IBAN Sagè Pharma inserito; operatore logistico NEW CIENNE DISTRIBUZIONE S.R.L. con email per le richieste di evasione; IBAN Bioeleva inserito; la merce parte dal deposito CIENNE (Via Salvatore Piccolo 211, ASI Napoli), Via Guantai ad Orsolone diventa unità operativa amministrativa; pulsanti in blu Magistra.

## In sospeso dal gruppo
- Esempio del PDF/Excel d'ordine inviato oggi al deposito.
- Eventuali altri indirizzi CIENNE in copia per le richieste di evasione.
- Eventuali altre sedi operative o depositi.
- Capitale sociale Sagè Pharma: confermare se va indicato "interamente versato".
- Testi di informativa privacy, condizioni di vendita farmacie (versione definitiva) e condizioni di vendita privati validate da un legale.
- Spese di spedizione per i privati.
- Primi sconti privati del mese.
- Eccezioni IVA diverse dal 10%.
- Prezzi dei prodotti mancanti dal listino.
- Linee e aree terapeutiche dei prodotti; immagini prodotto.
- Contenuti per il chatbot (schede, FAQ).
