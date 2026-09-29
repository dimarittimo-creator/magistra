# Stato lavori

_Aggiornato da Claude Code a fine di ogni sessione._

- [ ] Fase 0 – Preparazione — **in corso** (29/09/2026): Node.js e Git installati, sito avviato in locale e controllato (desktop, smartphone, modalità scura), test verdi, primo commit fatto. Manca solo il database locale: servono WSL e Docker Desktop.
- [ ] Fase 1 – Registrazione, accesso, società e sedi
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
