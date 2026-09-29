# Architettura

## Struttura del progetto

```
app/
  (pubblico)/        home con scelta Farmacie / Privati, login, registrazione (farmacia e privato),
                     recupero password, attesa approvazione, condizioni farmacie, condizioni privati, privacy
  (farmacia)/        catalogo, prodotto/[codice], carrello, ordini, ordini/[id], profilo
  (privati)/         negozio, prodotto/[codice], carrello, ordini, ordini/[id], profilo
  admin/             cruscotto, magazzino, prodotti, sconti, ordini, spedizioni, farmacie,
                     gruppi, promozioni, privati (clienti, sconti del mese, spese di spedizione),
                     società, sedi e depositi, condizioni di vendita, pagamenti,
                     impostazioni, chatbot, operatore, registro
  api/               route handler (import, export, pdf, cron, chat)
lib/
  pricing/           calcolo prezzi e sconti farmacie e privati (unica fonte)
  availability/      disponibilità, impegni, stati prodotto/lotto
  import/            parser giacenza deposito (.xls Crystal) e listino, modello pulito
  documents/         PDF ed Excel (ordine, DDT simulato, richiesta di evasione)
  email/             template e invio Brevo
  chat/              chatbot, strumenti, base di conoscenza
supabase/migrations/ schema SQL versionato
tests/               Vitest + Playwright
```

## Database (tabelle principali)

**Utenti e farmacie**
- `farmacie`: ragione_sociale, titolare, partita_iva, codice_fiscale, codice_farmacia, sdi, pec, email, telefono, stato (`in_attesa` | `attiva` | `bloccata`), gruppo_id, approvata_da, approvata_il.
- `indirizzi`: farmacia_id, tipo (`consegna` | `fatturazione`), indirizzo, cap, citta, provincia.
- `farmacie`: aggiungere societa_predefinita_id (null = predefinita del portale).
- `privati`: nome, cognome, codice_fiscale, email, telefono, stato (`attivo` | `bloccato`), creato_il.
- `indirizzi`: anche per i privati (privato_id in alternativa a farmacia_id).
- `profili_utente`: collegato a `auth.users`; ruolo (`farmacia` | `privato` | `admin` | `operatore` | `deposito`), farmacia_id, privato_id, sede_id (solo ruolo deposito).
- `consensi`: utente, tipo (privacy, condizioni_vendita_farmacie, condizioni_vendita_privati, marketing), versione_documento, accettato_il, ip.

**Società e sedi** (dettagli in `SOCIETA_E_SEDI.md`)
- `societa`: ragione_sociale, nome_breve, indirizzo sede legale, partita_iva, codice_fiscale, sdi, pec, rea, capitale_sociale_testo, sito, email, telefono, iban, logo_path, piede_documenti, attiva_farmacie, attiva_privati, predefinita, attiva.
- `sedi`: societa_id, tipo (`legale` | `operativa` | `deposito`), nome, indirizzo, cap, citta, provincia, telefono, email, email_cc, referente, orari, predefinito (per i depositi), operatore_id (→ `operatori_logistici`, solo depositi), attiva, note.
- `operatori_logistici`: ragione_sociale, nome_breve, partita_iva, codice_fiscale, sede_legale, sede_operativa, email, pec, telefono, cellulare, referente, percentuale_compenso (default 2), attivo, note.

**Catalogo**
- `linee`, `aree_terapeutiche`.
- `prodotti`: codice (minsan 9 cifre, PK), nome, nome_breve, formato, linea_id, area_id, immagine_path, prezzo_pubblico_cent (null = non visibile), iva_override, minimo_ordine, multiplo, soglia_esaurimento, codice_interno_deposito, visibile_privati, attivo.
- `lotti`: id, prodotto_codice, deposito_id (→ `sedi`), codice_lotto, scadenza (null = mancante), giacenza, sconto_manuale (null = fascia), import_id. Unico su (prodotto, deposito, codice_lotto).
- `giacenze_prodotto`: prodotto_codice, totale_dichiarato, import_id (serve per la regola di difformità).

**Condizioni commerciali**
- `fasce_sconto`: mesi_minimi, sconto_percentuale, attiva; `fasce_sconto_storico`.
- `impostazioni`: iva_predefinita, giorni_validita_prenotazione, giorni_consegna_indicativi (default 5), soglia_minima_ordine, soglia_trasporto_gratuito, costo_trasporto, orario_invio_cumulativo, ore_sollecito_ddt, mesi_minimi_lotto_privati (default 6), area_privati_attiva (default no). Gli indirizzi email del deposito stanno in `sedi`.
- `gruppi`, `listini_gruppo` (gruppo, prodotto, prezzo o sconto).
- `promozioni`: nome, tipo (`sconto_percentuale` | `sconto_merce` | `omaggio`), parametri (json: es. {compra:10, omaggio:2}), ambito (`prodotto` | `lotto` | `linea` | `catalogo`), riferimento_id, gruppo_id (null = tutti), inizio, fine, stato, duplicata_da.
- `modalita_pagamento`: codice, descrizione, canale (`farmacie` | `privati` | `entrambi`), costo_aggiuntivo_cent, attiva, ordine; `modalita_pagamento_farmacia` / `_gruppo` per eventuali limitazioni.
- `condizioni_vendita`: canale (`farmacie` | `privati`), versione, testo, attiva_dal, creato_da.
- `sconti_privati`: ambito (`catalogo` | `linea` | `prodotto`), riferimento_id, sconto_percentuale, inizio, fine, copiato_da, stato.
- `spese_spedizione`: canale, importo_cent, soglia_gratuita_cent, iva, attiva (vuota finché Salvatore non indica i valori).

**Ordini**
- `ordini`: numero (es. P-2026-00001), canale (`farmacie` | `privati`), farmacia_id o privato_id, societa_id, deposito_id, stato, modalita_pagamento_id (obbligatoria), pagamento_ricevuto_il, note, data_consegna_desiderata, consegna_indicativa_giorni, scade_il, snapshot_cliente (json), snapshot_societa (json), condizioni_versione, spese_spedizione_cent, totali (imponibile, sconti, iva, spedizione, totale), creato_il.
- `righe_ordine`: ordine_id, lotto_id, prodotto_codice, quantita, quantita_omaggio, prezzo_pubblico_cent, iva, sconto_applicato, origine_sconto (`fascia` | `lotto` | `promozione` | `listino_gruppo` | `sconto_privati`), promozione_id, prezzo_farmacia_netto_cent.
- `storico_stati`: ordine_id, da, a, utente, messaggio, il.

**Deposito e spedizioni** (dettagli in `DEPOSITO_E_SPEDIZIONI.md`)
- `invii_deposito`: id, deposito_id, ordini inclusi, destinatari, file PDF/Excel, inviato_il, esito.
- `spedizioni`: ordine_id, stato, ddt_numero, ddt_data, corriere, tracking, colli, ddt_pdf_path, registrata_da.
- `righe_spedizione`: spedizione_id, riga_ordine_id, lotto_spedito, quantita_spedita, nota_differenza.

**Magazzino**
- `import_magazzino`: file, deposito_id, tipo (`deposito_crystal` | `modello` | `listino`), data_giacenza, stato (`anteprima` | `applicato` | `annullato`), riepilogo, errori, utente.

**Chatbot** (fase 6)
- `kb_documenti`, `kb_frammenti` (embedding pgvector), `conversazioni`, `messaggi`, `richieste_operatore`, `domande_senza_risposta`.

**Controllo**
- `registro_operazioni`: utente, azione, entità, id, prima/dopo (json), il.

## Job pianificati (Vercel Cron)
- Ogni 15 minuti: scadenza prenotazioni non confermate; attivazione/disattivazione promozioni.
- All'orario impostato: invio cumulativo a ciascun deposito.
- Il 1° di ogni mese: attivazione degli sconti privati del mese e chiusura dei precedenti; 5 giorni prima di fine mese: promemoria all'admin se il mese successivo non ha sconti privati.
- Ogni ora: sollecito DDT mancanti oltre la soglia.
- Ogni notte: ricalcolo fasce (solo per notifiche; il calcolo prezzi è sempre al volo).

## Pagine

**Pubbliche:** home Magistra con scelta "Farmacie" / "Privati", login, registrazione farmacia, registrazione privato, recupero password, iscrizione in attesa, condizioni di vendita farmacie, condizioni di vendita privati, informativa privacy.

**Farmacia:** catalogo con filtri (prodotto, linea, area terapeutica) e badge di stato; scheda prodotto con tabella lotti, scadenze, sconti e 4 prezzi; carrello (lotto, quantità, società che fattura e consegna, modalità di pagamento obbligatoria); riepilogo con imponibile, sconti, IVA, totale, soglie, consegna indicativa e accettazione delle condizioni di vendita; I miei ordini con stati, download e "ripeti ordine"; profilo; chat.

**Privati:** negozio con prezzo pieno, sconto del mese e prezzo finale; scheda prodotto; carrello (quantità, società, pagamento obbligatorio, spese di spedizione); riepilogo con accettazione condizioni privati; I miei ordini; profilo.

**Admin:** cruscotto (con filtro per società e canale); società; sedi e depositi; condizioni di vendita; modalità di pagamento; clienti privati; sconti privati del mese; spese di spedizione; magazzino (import/export, modello); prodotti; sconti per scadenza (vedi `design/riferimento_pannello_sconti.html`); ordini; spedizioni; farmacie e gruppi; listini di gruppo; promozioni con calendario; impostazioni; chatbot; pannello operatore; registro operazioni.
