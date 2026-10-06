# Regole commerciali (vincolanti)

Decise da Salvatore Di Marino il 28/09/2026. Prevalgono sulla specifica.

Queste regole riguardano l'**area Farmacie (B2B)**. Per i privati valgono le regole di `AREA_PRIVATI.md`; prezzi di listino, IVA e disponibilità sono comuni ai due canali.

## 1. Prezzo di listino e IVA

- Il prezzo del listino è il **prezzo al pubblico IVA inclusa**.
- Aliquota IVA predefinita: **10%**. Le eccezioni si impostano a mano sul singolo prodotto (campo `iva_override`, vuoto = predefinita). L'aliquota predefinita è modificabile nelle impostazioni.
- Prodotto senza prezzo → **non visibile** alle farmacie finché l'admin non lo inserisce.

## 2. Sconto per fascia di scadenza

Lo sconto si applica al prezzo al pubblico IVA inclusa e dipende da quanto manca alla scadenza del lotto, calcolato **ogni giorno** rispetto alla data corrente.

Valori iniziali (tabella `fasce_sconto`, **modificabile dall'admin**):

| Fascia | Condizione | Sconto |
|---|---|---|
| 1 | scadenza ≥ oggi + 8 mesi | 38% |
| 2 | scadenza ≥ oggi + 6 mesi e < oggi + 8 mesi | 40% |
| 3 | scadenza < oggi + 6 mesi | 45% |

- "oggi + N mesi" funziona come `EDATE` di Excel (stesso giorno del mese, con fine mese se il giorno non esiste).
- L'admin può aggiungere o togliere fasce e cambiare mesi e percentuali. Serve sempre una fascia da 0 mesi. Le fasce non possono avere mesi duplicati.
- Prima di salvare: anteprima di quanti lotti cambiano prezzo. Storico delle modifiche con data e utente.
- **Sconto sul singolo lotto:** l'admin può sovrascrivere lo sconto della fascia per un lotto; se svuota il campo torna la fascia.
- Predisporre (non attiva) una fascia "non vendibile" sotto una soglia di mesi, per un eventuale uso futuro.

### Formule (per ogni lotto)

```
pubblico_ivato      = prezzo di listino
pubblico_netto      = round2(pubblico_ivato / (1 + iva))
farmacia_ivato      = round2(pubblico_ivato × (1 − sconto))
farmacia_netto      = round2(farmacia_ivato / (1 + iva))
```

La farmacia vede **tutti e quattro** i valori. Esempio: Lactorepens 60 cpr, lotto 2600169, pubblico 65,00 € → sconto 38% → 40,30 € IVA inclusa → **36,64 € IVA esclusa**.

Imponibile d'ordine = somma di `farmacia_netto × quantità`; IVA calcolata per aliquota sul totale imponibile.

## 3. Stato dei lotti e dei prodotti

Nell'ordine di priorità:

1. **Difformità:** se la somma delle quantità dei lotti di un prodotto ≠ giacenza totale dichiarata dal deposito per quel prodotto → **tutto il prodotto è "Mancante temporaneamente"**. Nessuna correzione automatica. L'admin riceve un avviso con la differenza; il prodotto torna disponibile al primo import in cui i numeri coincidono. (Caso reale: ELIVID 60 cpr, lotti 297 + 2.020 = 2.317, totale dichiarato 2.314.)
2. **Lotto senza data di scadenza** → "Mancante".
3. **Lotto scaduto** → non vendibile, non mostrato alle farmacie.
4. **Prodotto senza prezzo** → non visibile.
5. Altrimenti → disponibile, con la fascia di sconto calcolata.

Badge "In esaurimento" quando la disponibilità del prodotto scende sotto una soglia configurabile (default 50 pezzi).

## 4. Combinazione degli sconti

Ordine di calcolo:
1. prezzo del listino di gruppo della farmacia, se esiste, altrimenti prezzo di listino;
2. sconto del lotto (fascia di scadenza o sconto manuale sul lotto);
3. promozione attiva: **vale il migliore** tra sconto del lotto e promozione, **non la somma**;
4. sconto merce (es. 10+2) e omaggi: **cumulabili**. I pezzi in omaggio hanno prezzo zero ma **impegnano giacenza** dello stesso lotto (o del lotto indicato).

## 5. Disponibilità e prenotazioni

```
disponibile(lotto) = giacenza_importata
                   − quantità impegnate negli ordini aperti
                   − quantità spedite dopo la data della giacenza importata
```

- Ordini aperti: Inviato, In verifica, Confermato, Modificato, Inviato al deposito, In preparazione.
- All'invio dell'ordine, verifica e impegno avvengono **in un'unica transazione** con blocco delle righe dei lotti (`SELECT … FOR UPDATE`): se la merce non basta più, l'ordine non parte e la farmacia vede quale riga correggere.
- Una prenotazione non confermata entro **3 giorni lavorativi** (configurabile) passa a "Scaduto" e libera la merce. Email alla farmacia.
- Se un nuovo import porta la giacenza di un lotto sotto l'impegnato, avviso all'admin.

## 6. Modalità di pagamento

- La modalità di pagamento è **obbligatoria in ogni ordine**: senza non si può inviare.
- Elenco modificabile dall'admin (tabella `modalita_pagamento`), separato per canale:
  - farmacie, valori iniziali: bonifico anticipato, RIBA 30/60/90 gg, contrassegno;
  - privati: vedi `AREA_PRIVATI.md`.
- L'admin può limitare le modalità per singola farmacia o gruppo (es. RIBA solo per clienti storici).
- La modalità scelta compare su riepilogo, email, export, DDT simulato e richiesta di evasione (per il contrassegno, importo da incassare in evidenza).

## 7. Condizioni di vendita farmacie (B2B)

Da mostrare nella pagina "Condizioni di vendita", nel riepilogo prima dell'invio (con casella **"Ho letto e accetto"** obbligatoria), nell'email di conferma, nell'export e nel DDT simulato. Testo modificabile dall'admin, con versione; ogni ordine salva la versione accettata.

**Aggiornamento 06/10/2026:** sono in vigore le condizioni generali fornite da Salvatore (`docs/legale/definitivi/condizioni_farmacie_v2.md`, versione 2 sul portale). Prevalgono sulle clausole iniziali qui sotto, in particolare:
- **rischio del trasporto** (art. 6.3): passa alla farmacia **alla consegna** all'indirizzo concordato, non alla partenza;
- **resi** (art. 8): nessun reso commerciale né per ripensamento, ma restano i rimedi per vizi, merce diversa o mancante, errori di fornitura e durata residua non conforme;
- **durata residua** (art. 7.1): almeno **8 mesi** alla consegna; i lotti più corti si vendono solo con **accettazione espressa** nel carrello (impostazione `mesi_durata_residua_garantita`, casella obbligatoria, `ordini.durata_ridotta_accettata`);
- **ordini modificati** (art. 4.3): dopo una modifica dell'amministrazione l'ordine resta «Modificato» con `modifiche_da_accettare`; il cliente accetta o rifiuta dalla pagina dell'ordine (email con pulsante); niente invio al deposito prima dell'accettazione; se rifiuta l'ordine si chiude, se non risponde entro la validità della prenotazione scade (`rispondi_modifiche_ordine`, `scadi_prenotazioni`).

Clausole iniziali (superate dalle condizioni del 06/10/2026):
1. **In nessun caso sono previsti resi.**
2. **La merce viaggia a rischio e pericolo dell'acquirente.**
3. **Tempi di consegna:** dipendono dall'andamento del magazzino; in linea di massima la consegna avviene **entro 5 giorni lavorativi** dalla conferma dell'ordine. Il valore (5) è un'impostazione modificabile e compare come "consegna indicativa" nel carrello e nel riepilogo; non è mai presentato come termine garantito.
4. La modalità di pagamento è quella indicata nell'ordine.
5. La società che fattura e consegna è quella indicata nell'ordine (Sagè Pharma o Bioeleva, vedi `SOCIETA_E_SEDI.md`).

Suggerimento per la farmacia (testo nel riepilogo): controllare i colli alla consegna e annotare eventuali danni sul documento del corriere.

## 8. Altre impostazioni di default (modificabili)

- Soglia minima d'ordine e soglia trasporto gratuito: vuote finché l'admin non le imposta.
- Minimo e multiplo d'ordine per prodotto: default 1.
- La colonna "Azienda produttrice" del file del deposito è un codice interno: si importa ma **non si mostra** alle farmacie.
