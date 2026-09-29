# Stato lavori

_Aggiornato da Claude Code a fine di ogni sessione._

- [x] Fase 0 – Preparazione — **completata** (29/09/2026): Node.js, Git, WSL e Docker Desktop installati; database locale avviato con le due società (con IBAN), le quattro sedi e l'operatore CIENNE collegato al deposito predefinito; test verdi.
- [x] Fase 1 – Registrazione, accesso, società e sedi — **completata** (29/09/2026), in attesa dell'ok di Salvatore: test verdi (12 Vitest, 4 Playwright).
- [ ] Fase 2 – Catalogo e prenotazione farmacie
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

## Decisioni del 29/09/2026 (Fase 1)
- **Codice farmacia**: lo assegna il portale all'iscrizione, numero progressivo da **0100** in avanti; la farmacia non lo inserisce e non si modifica (migrazione `20260929140000_codice_farmacia_progressivo.sql`).
- **Avvisi di nuova iscrizione**: a tutti gli utenti admin.

## Punti da chiarire (emersi in Fase 1)
- Informativa privacy e condizioni di vendita definitive: sostituiscono i testi provvisori creando una nuova versione (pagina admin in Fase 3).

## Punti da chiarire (emersi in Fase 0)
- `verifica_prezzi_attesi.xlsx` calcola il prezzo farmacia IVA esclusa in un solo passaggio (pubblico × (1 − sconto) ÷ (1 + IVA)), mentre `REGOLE_COMMERCIALI.md` arrotonda prima il prezzo IVA inclusa. Su alcuni lotti può esserci 1 centesimo di differenza: da verificare in Fase 2.
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
