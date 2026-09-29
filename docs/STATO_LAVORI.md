# Stato lavori

_Aggiornato da Claude Code a fine di ogni sessione._

- [x] Fase 0 – Preparazione — **completata** (29/09/2026): Node.js, Git, WSL e Docker Desktop installati; database locale avviato con le due società (con IBAN), le quattro sedi e l'operatore CIENNE collegato al deposito predefinito; test verdi.
- [x] Fase 1 – Registrazione, accesso, società e sedi — **completata** e approvata (29/09/2026).
- [x] Fase 2 – Catalogo e prenotazione farmacie — **completata** (29/09/2026), in attesa dell'ok di Salvatore: test verdi (90 Vitest, 10 Playwright).
- [ ] Fase 3 – Amministrazione e spedizioni al deposito
- [ ] Fase 4 – Documenti
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
