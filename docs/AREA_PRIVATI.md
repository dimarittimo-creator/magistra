# Area Privati – B2C (vincolante)

Decisione di Salvatore Di Marino del 28/09/2026.

## 1. Accesso

- Area separata dall'area Farmacie, con propria pagina di ingresso ("Sei una farmacia?" / "Sei un privato?").
- Registrazione del privato: nome, cognome, codice fiscale (serve per la fattura), email, telefono, indirizzo di spedizione, eventuale indirizzo di fatturazione diverso; consensi privacy, condizioni di vendita privati, eventuale marketing.
- Nessuna approvazione manuale: l'account è attivo dopo la conferma dell'email. L'admin può bloccarlo.
- È anche possibile ordinare dopo aver creato l'account durante il primo ordine (niente ordini anonimi).

## 2. Catalogo e prezzi

- Stesso catalogo prodotti; l'admin decide per ogni prodotto se è visibile ai privati (campo `visibile_privati`, default sì se ha un prezzo).
- Prezzo di partenza = **prezzo al pubblico IVA inclusa** del listino.
- I privati **non** vedono lotti, giacenze, prezzi farmacia né sconti per scadenza. Vedono: prezzo pieno, eventuale sconto del mese, prezzo finale IVA inclusa, "disponibile" / "non disponibile".
- Gli sconti per fascia di scadenza e i listini di gruppo delle farmacie **non** si applicano ai privati.

## 3. Sconti mensili privati

Pannello admin "Sconti privati del mese":
- sconto globale (tutto il catalogo) e/o sconto per prodotto o per linea, in percentuale sul prezzo al pubblico IVA inclusa;
- ogni sconto ha un mese di validità (dal primo all'ultimo giorno, oppure date a scelta);
- se ci sono più sconti validi per lo stesso prodotto vale **il migliore**, non la somma;
- a fine periodo lo sconto scade da solo; pulsante **"Copia sul mese successivo"** per rinnovarlo con un clic;
- promemoria all'admin (email) 5 giorni prima della fine del mese se il mese successivo non ha sconti impostati;
- anteprima dei prezzi finali prima di salvare; storico con data e utente.

Formula:
```
privato_ivato = round2(pubblico_ivato × (1 − sconto_mese))
privato_netto = round2(privato_ivato / (1 + iva))
```

## 4. Assegnazione del lotto

Il privato non sceglie il lotto. Il sistema assegna il lotto disponibile con la **scadenza più vicina tra quelli con almeno N mesi di vita residua** (N configurabile, default 6 mesi). I lotti sotto la soglia restano per le farmacie. Stesse regole di disponibilità e impegno transazionale delle farmacie (`REGOLE_COMMERCIALI.md` §5).

## 5. Spese di spedizione

- Tabella `spese_spedizione` modificabile dall'admin: importo fisso per ordine, eventuale soglia oltre la quale la spedizione è gratuita, eventuali costi aggiuntivi (es. contrassegno), IVA applicata alle spese.
- **I valori li indicherà Salvatore in seguito.** Finché la tabella è vuota, l'area Privati può essere provata in locale ma **non può essere attivata online** (blocco nelle impostazioni con messaggio chiaro all'admin).
- Le spese compaiono come riga separata nel riepilogo, nelle email e negli export.

## 6. Ordine, pagamento e consegna

- Nel carrello il privato indica: società che fattura e consegna (se attive entrambe), **modalità di pagamento obbligatoria** (elenco B2C modificabile; valori iniziali: bonifico anticipato, contrassegno), note.
- Il pagamento con carta online è **predisposto ma non attivo** (richiede un contratto con un gestore di pagamenti, da decidere con Salvatore).
- L'ordine del privato segue lo stesso flusso: Inviato → Confermato → Inviato al deposito → Spedito → Consegnato. Con bonifico anticipato l'ordine va al deposito solo dopo che l'admin segna "pagamento ricevuto".
- Tempi di consegna indicativi come per le farmacie (in linea di massima entro 5 giorni lavorativi, dipende dall'andamento del magazzino).

## 7. Condizioni di vendita privati

Testo separato da quello delle farmacie, modificabile dall'admin, con versione e accettazione obbligatoria. **Le clausole B2B "nessun reso" e "merce a rischio dell'acquirente" non vanno applicate ai privati** senza parere legale: vedi `CONFORMITA.md` §Tutela del consumatore. Finché il gruppo non fornisce il testo validato, usare un segnaposto evidente e mantenere l'area non attivabile online.
