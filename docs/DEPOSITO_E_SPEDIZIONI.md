# Deposito e spedizioni

Decisione del 28/09/2026: **si parte via email**. Vale per gli ordini delle farmacie e dei privati, per entrambe le società (Sagè Pharma e Bioeleva). Depositi e indirizzi email sono nella tabella `sedi` (vedi `SOCIETA_E_SEDI.md`). La merce parte dal deposito **NEW CIENNE DISTRIBUZIONE S.R.L.**, Via Salvatore Piccolo 211 – 80014 ASI Napoli (luogo di partenza su DDT simulato e richiesta di evasione); le richieste di evasione vanno a **ordini@sagepharma.eu** (decisione del 05/10/2026; prima andavano a CIENNE, a.nuzzo@ciennegroup.it). L'accesso diretto del deposito (ruolo `deposito`) va predisposto nel database e nei permessi, ma non attivato.

## Stati dell'ordine

```
Inviato → In verifica → Confermato | Modificato | Rifiutato | Scaduto
Confermato/Modificato → Inviato al deposito → In preparazione → Spedito → Consegnato
```

Ogni cambio di stato: riga in `storico_stati` + email al cliente (farmacia o privato), con la società che fattura e consegna.

Ordini dei privati con bonifico anticipato: passano a "Inviato al deposito" solo dopo che l'admin segna "pagamento ricevuto".

## 1. Richiesta di evasione al deposito

Dopo la conferma, l'admin invia l'ordine al deposito. Due modalità (impostazione):
- **singola:** pulsante "Invia al deposito" sul singolo ordine;
- **cumulativa:** tutti gli ordini confermati partono in un'unica email per deposito all'orario impostato (default 12:00), con un file per ordine.

Email agli indirizzi del **deposito di partenza** dell'ordine (`sedi.email`, copia a `sedi.email_cc`). Allegati: **PDF + Excel** della richiesta di evasione, con:
- numero ordine portale e data;
- **società che fattura e consegna** (ragione sociale, P.IVA), da usare come mittente sul DDT;
- deposito di partenza;
- canale (farmacia / privato);
- destinatario: per le farmacie ragione sociale, codice farmacia, partita IVA; per i privati nome, cognome, codice fiscale; sempre indirizzo di consegna e telefono;
- per ogni riga: codice minsan, descrizione, **lotto da prelevare**, scadenza, quantità;
- **omaggi e sconto merce su righe separate** (causale diversa sul DDT);
- data di consegna desiderata e note della farmacia;
- modalità di pagamento; per il **contrassegno** l'importo da incassare in evidenza;
- prezzi: opzionali (impostazione), di default **non** inclusi.

Il formato definitivo va allineato al file che Sagè Pharma invia oggi al deposito. Se non disponibile, proponi un formato standard e fallo approvare.

## 2. Registrazione del DDT

Sull'ordine, l'admin o l'operatore registra: numero e data DDT, corriere, tracking, colli, PDF del DDT.

Se il deposito ha spedito quantità o lotti diversi, si registrano riga per riga in `righe_spedizione`. L'ordine mostra le differenze; la disponibilità si aggiorna.

Avviso automatico se un ordine resta "Inviato al deposito" senza DDT oltre `ore_sollecito_ddt` (default 48).

## 3. Cosa vede la farmacia

Stato aggiornato, numero e data DDT, corriere e tracking. Dopo la spedizione scarica il **DDT reale**, che sostituisce la simulazione.

## 4. Verso la fatturazione (il portale NON emette fatture)

- Elenco **"DDT da fatturare"** esportabile in Excel, **filtrabile e separato per società** (Sagè Pharma / Bioeleva) e per canale: società emittente, ordine, farmacia, dati fiscali, DDT, righe, imponibile, IVA, totale, modalità di pagamento e scadenze RIBA. Flag "fatturato" impostabile dall'admin.
- Report **valore distribuito per mese**, per deposito e per società (somma imponibile dei DDT del mese), utile per verificare la fattura mensile del deposito (2% del distribuito).

## 5. Disponibilità dopo la spedizione

La merce spedita dopo la data della giacenza importata continua a essere sottratta finché un nuovo import con data successiva non la comprende. Nessun doppio conteggio, nessuna doppia vendita.
