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
- `profili_utente`: collegato a `auth.users`; ruolo (`farmacia` | `privato` | `admin` | `operatore` | `deposito`), nome, email, farmacia_id, privato_id, sede_id (solo ruolo deposito).
- `consensi`: utente_id, tipo (privacy, condizioni_vendita_farmacie, condizioni_vendita_privati, marketing), accettato, documento_id, versione_documento, ip, user_agent, il. Una riga per ogni scelta (anche il ritiro del consenso marketing); non modificabili, si cancellano solo insieme all'account.
- `documenti_legali` (Fase 1, sostituisce `condizioni_vendita`): tipo (`privacy` | `condizioni_farmacie` | `condizioni_privati`), versione, titolo, testo, provvisorio, in_vigore_dal, creato_da. Una versione pubblicata non si modifica: se ne crea una nuova. Funzione `documento_legale_corrente(tipo)`.
- `storico_modifiche` (Fase 1): tabella, record_id, prima/dopo (json), utente, il. Scritta dai trigger su `societa`, `sedi`, `farmacie`, `gruppi`; non modificabile.
- Registrazione farmacia: funzione `registra_farmacia(...)` (solo chiave di servizio) che crea farmacia, indirizzi, profilo e consensi in un'unica transazione. Il trigger `farmacie_protegge_campi` impedisce alla farmacia di cambiare dati identificativi, stato, gruppo e società predefinita.

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
- `impostazioni`: iva_predefinita, giorni_validita_prenotazione, giorni_consegna_indicativi (default 5), soglia_minima_ordine, soglia_trasporto_gratuito, costo_trasporto, orario_invio_cumulativo, ore_sollecito_ddt, mesi_minimi_lotto_privati (default 6), area_privati_attiva (default no), email_notifiche_admin (vuoto = tutti gli admin). Gli indirizzi email del deposito stanno in `sedi`.
- `gruppi` (nome, descrizione, attivo; Fase 1), `listini_gruppo` (gruppo, prodotto, prezzo o sconto; Fase 3).
- `promozioni`: nome, tipo (`sconto_percentuale` | `sconto_merce` | `omaggio`), parametri (json: es. {compra:10, omaggio:2}), ambito (`prodotto` | `lotto` | `linea` | `catalogo`), riferimento_id, gruppo_id (null = tutti), inizio, fine, stato, duplicata_da.
- `modalita_pagamento`: codice, descrizione, canale (`farmacie` | `privati` | `entrambi`), costo_aggiuntivo_cent, attiva, ordine; `modalita_pagamento_farmacia` / `_gruppo` per eventuali limitazioni.
- Condizioni di vendita: vedi `documenti_legali` (tipi `condizioni_farmacie` e `condizioni_privati`).
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

**Chatbot** (fase 6, dettagli nella sezione "Fase 6")
- `kb_documenti`, `kb_frammenti` (indice testuale + embedding pgvector facoltativo), `conversazioni`, `messaggi`, `proposte_carrello`, `richieste_operatore`, `domande_senza_risposta`.

**Controllo**
- `registro_operazioni`: utente, azione, entità, id, prima/dopo (json), il.

## Accesso e sessioni (Fase 1)
- Supabase Auth con email e password (almeno 8 caratteri, lettere e numeri) e conferma dell'indirizzo email obbligatoria.
- Le email di sistema (conferma, recupero password) usano i modelli in italiano di `supabase/templates/` e portano a `/auth/conferma?token_hash=…`, che verifica il codice e collega l'utente (funziona anche se l'email si apre su un altro dispositivo). **In produzione** gli stessi modelli vanno copiati nel pannello Supabase (Authentication → Email Templates) e l'SMTP va collegato a Brevo.
- `proxy.ts` rinnova la sessione e rimanda all'accesso chi apre un'area riservata senza essere collegato; i permessi veri li controllano pagine, azioni (`lib/auth.ts`: `richiediAdmin`, `richiediStaff`, `richiediFarmacia`) e Row Level Security.
- `/area` porta ognuno alla propria area in base al ruolo.
- Email transazionali del portale (`lib/email`): Brevo se c'è `BREVO_API_KEY`, altrimenti in sviluppo la casella di prova locale Mailpit (http://127.0.0.1:54324).

## Fase 3 – aggiunte al database
- `modalita_pagamento_limiti` (modalità → gruppo o farmacia) e funzione `modalita_consentite_farmacia(farmacia)`.
- `listini_gruppo` (gruppo, prodotto, prezzo al pubblico e/o sconto riservato).
- `promozioni` (tipo, parametri, ambito, gruppo, inizio/fine, sospesa, duplicata_da); funzioni pure in `lib/promozioni.ts`.
- `invii_deposito`, `spedizioni` (DDT, PDF in Storage `ddt` privato, fatturato), `righe_spedizione` (lotto e quantità realmente spediti).
- `disponibilita_lotti` ora sottrae anche lo spedito dopo la data della giacenza; `modifica_ordine_admin` modifica un ordine con i lotti bloccati.
- Storico anche per prodotti, sconti sui lotti, spedizioni e promozioni. `import_magazzino.contenuto` conserva il file letto tra anteprima e conferma.
- Documenti: `lib/documents/richiesta-evasione.tsx` (PDF con @react-pdf/renderer + Excel), `lib/documents/excel-magazzino.ts`; invio in `lib/deposito/invio.ts`; fatturazione in `lib/fatturazione.ts`.

## Fase 5 – area Privati
- Tabelle `privati`, `sconti_privati`, `spese_spedizione`, `carrello_privati` (per prodotto); indirizzi e ordini collegati anche ai privati; funzioni `registra_privato`, `invia_ordine_privato`, `area_privati_attivabile` e trigger che rifiuta l'attivazione online senza spese e condizioni definitive.
- Regole pure: `lib/sconti-privati.ts` (sconto migliore, copia mese, promemoria), `prezzoPrivato` / `calcolaTotaliPrivati` / `speseSpedizione` in `lib/pricing`, `assegnaLottiPrivato` in `lib/availability`.
- Negozio lato server `lib/negozio.ts` (chiave di servizio, espone solo i dati per il cliente); pagine in `app/(privati)/negozio`.
- Negli ordini privati le colonne `prezzo_farmacia_ivato_cent` / `prezzo_farmacia_netto_cent` contengono il prezzo applicato al privato; `spese_spedizione_cent` è IVA inclusa ed è compresa in imponibile, IVA e totale.

## Promozioni con volantino e omaggio extra (05/10/2026)
- `promozioni.immagine_path`: volantino nell'archivio pubblico Supabase Storage `promozioni` (JPG/PNG/WebP, max 5 MB), caricato dall'admin; le farmacie lo vedono in «Offerte in corso» (pagina iniziale) e nella scheda prodotto finché la promozione è attiva (`Catalogo.offerte`).
- Omaggio extra non a magazzino (`omaggio_extra_testo/ogni/quantita`, es. 1 espositore ogni 24 pezzi): non impegna giacenza; `calcolaOmaggiExtra` in `lib/promozioni.ts` somma i pezzi delle righe a cui la promozione si applica (anche lotti diversi). Fotografato all'invio in `ordini.omaggi_extra` e riportato in carrello, dettaglio ordine, email, PDF/Excel, DDT simulato e richiesta di evasione (causale "Omaggio (materiale promozionale)"). Le modifiche admin di un ordine non lo ricalcolano.

## Fase 6 – assistente (chatbot)
- **Separazione dal canale**: base di conoscenza (`lib/chat/kb.ts`), strumenti (`lib/chat/strumenti.ts`) e conversazioni (`lib/chat/conversazioni.ts`) non dipendono dalla chat web; la finestra `components/chat/Assistente.tsx` e la route `/api/assistente` sono solo il canale "chat". Una versione vocale userà le stesse funzioni (`conversazioni.canale = 'voce'`); `kb_documenti.pubblico` prevede già `medici`.
- **Modello**: Claude Opus 5.5 con SDK ufficiale `@anthropic-ai/sdk` (`lib/chat/modello.ts`): streaming, ragionamento adattivo, sforzo `medium`, istruzioni fisse in cache (`lib/chat/prompt.ts`), riserva automatica lato server se i filtri di sicurezza rifiutano per errore (`fallbacks: "default"`). La storia inviata al modello è **solo accodata** (ogni turno si salva in `messaggi.api` e si rimanda identico); risposte dell'operatore e decisioni sulle proposte arrivano come note nel messaggio successivo dell'utente.
- **Modalità** (`lib/chat/modalita.ts`): `ai` con la chiave; `prova` in locale senza chiave o nei test (cookie `magistra_assistente=prova`, mai in produzione) con risposte simulate che usano gli stessi strumenti (`lib/chat/modello-prova.ts`); `solo_operatore` online senza chiave.
- **Strumenti** (con il client della farmacia: vale la RLS): `cerca_prodotti`, `dettaglio_prodotto`, `promozioni_attive` (da `lib/catalogo` → `lib/pricing`/`lib/availability`/`lib/promozioni`), `stato_ordini`, `informazioni_vendita` (impostazioni, pagamenti consentiti, società, condizioni in vigore), `cerca_informazioni` (base di conoscenza approvata), `proponi_aggiunta_carrello` (crea solo una proposta), `passa_a_operatore`, `registra_domanda_senza_risposta`. La merce entra nel carrello solo con «Conferma» (`decidiProposta` → `aggiungiLottoAlCarrello` in `lib/carrello.ts`, gli stessi controlli del catalogo).
- **Database** (`20261001090000_fase6_chatbot.sql`): `kb_documenti` (bozza → approvato → archiviato; una modifica a un testo approvato lo rimette in bozza), `kb_frammenti` (paragrafi con indice testuale italiano e vettore pgvector facoltativo), funzione `cerca_kb` (solo documenti approvati; fonde ricerca per parole e per significato), `conversazioni`, `messaggi`, `proposte_carrello`, `richieste_operatore`, `domande_senza_risposta`, funzione `cancella_conversazioni_scadute`. Gli utenti leggono solo le proprie conversazioni; tutte le scritture passano dal server.
- **Ricerca per significato** facoltativa (`lib/chat/embedding.ts`, Voyage AI con `VOYAGE_API_KEY`): senza chiave la ricerca è per parole.
- **Limiti**: 2000 caratteri per messaggio, 15 messaggi in 5 minuti, 200 al giorno, 120 per conversazione, 8 giri di strumenti per risposta.
- **Operatore**: `/admin/assistente` (richieste aperte, storico), `/admin/assistente/[id]` (risposta nella stessa chat, email al cliente), `/admin/assistente/domande`; base di conoscenza `/admin/assistente/conoscenza` (solo admin, upload PDF/TXT/MD).

## Job pianificati (Vercel Cron)
- `/api/cron/scadenze` cancella anche le conversazioni oltre `impostazioni.mesi_conservazione_chat`.
- Ogni 15 minuti: `/api/cron/scadenze` (prenotazioni scadute) e `/api/cron/deposito` (invio cumulativo all'orario impostato, sollecito DDT mancanti). Entrambi protetti da `CRON_SECRET`.
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
