# Stato lavori

_Aggiornato da Claude Code a fine di ogni sessione._

- [x] Fase 0 – Preparazione — **completata** (29/09/2026): Node.js, Git, WSL e Docker Desktop installati; database locale avviato con le due società (con IBAN), le quattro sedi e l'operatore CIENNE collegato al deposito predefinito; test verdi.
- [x] Fase 1 – Registrazione, accesso, società e sedi — **completata** e approvata (29/09/2026).
- [x] Fase 2 – Catalogo e prenotazione farmacie — **completata** e approvata (29/09/2026).
- [x] Fase 3 – Amministrazione e spedizioni al deposito — **completata** e approvata (29/09/2026).
- [x] Fase 4 – Documenti — **completata** (30/09/2026), in attesa dell'ok di Salvatore: test verdi (94 Vitest, 23 Playwright).
- [ ] Fase 5 – Area Privati (B2C)
- [ ] Fase 6 – Chatbot
- [ ] Fase 7 – Messa online

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

## Fase 4 – cosa c'è
- **Riepilogo d'ordine in PDF ed Excel** (`lib/documents/ordine.tsx`), scaricabile dalla farmacia e dall'amministrazione (pulsanti "Documenti" nel dettaglio ordine): intestazione della **società che fattura** con logo (Sagè Pharma) o segnaposto con il nome (Bioeleva finché non arriva il logo), dati fiscali completi di società e cliente, righe con lotti, scadenze, prezzo al pubblico, sconto, prezzo netto e IVA, totali per aliquota, pagamento (con IBAN per il bonifico), consegna indicativa, condizioni di vendita accettate (versione dell'ordine); logo Magistra piccolo nel piè di pagina "Ordine effettuato tramite Magistra".
- **DDT simulato** in PDF: mittente = società scelta, luogo di partenza = indirizzo del deposito (senza i dati dell'operatore logistico), destinatario e luogo di destinazione, righe e totali, condizioni di vendita e la dicitura **"Documento non valido ai fini fiscali – prenotazione non vincolante"** in evidenza.
- **Dopo la spedizione** il DDT reale caricato dall'admin sostituisce il simulato tra i documenti.
- Gli importi sono quelli salvati nell'ordine: **PDF ed Excel coincidono al centesimo** con il riepilogo (test automatico, anche con due aliquote IVA). **Cambiando società** (modifica dall'admin) cambiano intestazione, dati fiscali e IBAN.
- La farmacia scarica solo i documenti dei propri ordini.
- Test: `tests/e2e/fase4.spec.ts`. Per il logo nei documenti si usa `public/brand/logo-sage-pharma-documenti.jpg` (versione leggera); per Bioeleva basta caricare il file e indicarne il percorso nella scheda della società.

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
- Logo Bioeleva.
- Testi di informativa privacy, condizioni di vendita farmacie (versione definitiva) e condizioni di vendita privati validate da un legale.
- Spese di spedizione per i privati.
- Primi sconti privati del mese.
- Eccezioni IVA diverse dal 10%.
- Prezzi dei prodotti mancanti dal listino.
- Linee e aree terapeutiche dei prodotti; immagini prodotto.
- Contenuti per il chatbot (schede, FAQ).
