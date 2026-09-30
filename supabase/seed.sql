-- Dati iniziali (docs/SOCIETA_E_SEDI.md). Gli IBAN NON sono qui:
-- stanno in supabase/seed_privato.sql, escluso dal repository (modello in supabase/esempi/).

insert into public.impostazioni (id) values (true);

-- Operatore logistico del deposito
insert into public.operatori_logistici
  (ragione_sociale, nome_breve, partita_iva, codice_fiscale, sede_legale, sede_operativa,
   email, pec, telefono, cellulare, percentuale_compenso)
values
  ('NEW CIENNE DISTRIBUZIONE S.R.L.', 'CIENNE', '10664671210', '10664671210',
   'Centro Direzionale, Isola G1, Scala D, Int. 21 – 80143 Napoli (NA)',
   'Via Salvatore Piccolo, 211 – 80014 ASI Napoli (NA)',
   'a.nuzzo@ciennegroup.it', 'newciennedistribuzione@pec.it', '081 18902097', '320 2171312', 2);

-- Società emittenti
insert into public.societa
  (codice, ragione_sociale, nome_breve,
   sede_legale_indirizzo, sede_legale_cap, sede_legale_citta, sede_legale_provincia,
   partita_iva, codice_fiscale, sdi, pec, rea, capitale_sociale_testo, sito, logo_path,
   attiva_farmacie, attiva_privati, predefinita, note)
values
  ('sage', 'SAGE'' PHARMA S.r.l.', 'Sagè Pharma',
   'Viale Antonio Gramsci, 21', '80122', 'Napoli', 'NA',
   '01698370994', '01698370994', 'M5UXCR1', 'sagepharma1@pec.it', 'NA - 853582',
   '€ 100.000,00', 'www.sagepharma.it', '/brand/logo-sage-pharma.jpg',
   true, true, true, 'Capitale sociale: confermare la dicitura "i.v."'),
  ('bioeleva', 'BIOELEVA S.r.l.', 'Bioeleva',
   'Viale Antonio Gramsci, 21', '80122', 'Napoli', 'NA',
   '04363330277', '04363330277', 'M5UXCR1', 'bioeleva@legalmail.it', 'NA - 1108752',
   '€ 13.612,00 i.v.', 'www.bioeleva.com', '/brand/logo-bioeleva.png',
   true, true, false, null);

-- Sedi iniziali
insert into public.sedi (societa_id, tipo, nome, indirizzo, cap, citta, provincia, telefono, email, predefinito, operatore_id, note)
select s.id, v.tipo::public.tipo_sede, v.nome, v.indirizzo, v.cap, v.citta, v.provincia, v.telefono, v.email, v.predefinito,
       case when v.tipo = 'deposito' then (select id from public.operatori_logistici where nome_breve = 'CIENNE') end,
       v.note
from (values
  ('sage', 'legale', 'Sede legale Sagè Pharma', 'Viale Antonio Gramsci, 21', '80122', 'Napoli', 'NA', null, null, false, null),
  ('sage', 'operativa', 'Unità operativa amministrativa Guantai ad Orsolone', 'Via Comunale Guantai ad Orsolone, 40/B', '80131', 'Napoli', 'NA', null, null, false,
   'Unità locale NA/5, aperta l''11/07/2024. Non è luogo di partenza della merce.'),
  ('sage', 'deposito', 'Deposito CIENNE', 'Via Salvatore Piccolo, 211', '80014', 'ASI Napoli', 'NA', '081 18902097', 'a.nuzzo@ciennegroup.it', true,
   'Gestito da NEW CIENNE DISTRIBUZIONE S.R.L. Spedisce per Sagè Pharma e Bioeleva.'),
  ('bioeleva', 'legale', 'Sede legale Bioeleva', 'Viale Antonio Gramsci, 21', '80122', 'Napoli', 'NA', null, null, false, null)
) as v(codice_societa, tipo, nome, indirizzo, cap, citta, provincia, telefono, email, predefinito, note)
join public.societa s on s.codice = v.codice_societa;

-- Testi legali provvisori (docs/CONFORMITA.md): segnaposto evidenti finché il gruppo
-- non fornisce i testi validati dal legale. Si sostituiscono creando una nuova versione.
insert into public.documenti_legali (tipo, versione, titolo, provvisorio, testo) values
('privacy', 1, 'Informativa sul trattamento dei dati personali', true,
$$**TESTO PROVVISORIO – in attesa del testo definitivo del consulente privacy.**

Titolari del trattamento: SAGE' PHARMA S.r.l. e BIOELEVA S.r.l., Viale Antonio Gramsci, 21 – 80122 Napoli (NA). Il rapporto tra le due società (contitolari oppure titolare e responsabile) sarà indicato nel testo definitivo.

Finalità: gestione della registrazione al portale Magistra, delle prenotazioni d'ordine, delle spedizioni e degli adempimenti fiscali; assistenza ai clienti; invio di comunicazioni commerciali solo con consenso separato e facoltativo.

Dati trattati: dati anagrafici e fiscali, recapiti, indirizzi di consegna e fatturazione, storico ordini, dati tecnici di accesso (data, ora, indirizzo IP).

Conservazione: per il tempo necessario al rapporto commerciale e agli obblighi di legge.

Fornitori che trattano dati per conto delle società: servizi di hosting e database in Unione Europea, servizio di invio email.

Diritti: accesso, rettifica, cancellazione, limitazione, portabilità, opposizione e reclamo al Garante per la protezione dei dati personali, scrivendo alle PEC delle società.$$),
('condizioni_farmacie', 1, 'Condizioni di vendita per le farmacie', true,
$$**TESTO PROVVISORIO – versione definitiva da confermare dal gruppo.**

1. **In nessun caso sono previsti resi.**
2. **La merce viaggia a rischio e pericolo dell'acquirente.** Si consiglia di controllare i colli alla consegna e di annotare eventuali danni sul documento del corriere.
3. **Tempi di consegna:** dipendono dall'andamento del magazzino; in linea di massima la consegna avviene entro i giorni lavorativi indicati nel carrello dalla conferma dell'ordine. Il termine è indicativo e non garantito.
4. La modalità di pagamento è quella indicata nell'ordine.
5. La società che fattura e consegna (Sagè Pharma S.r.l. o Bioeleva S.r.l.) è quella indicata nell'ordine.
6. Le prenotazioni inviate tramite Magistra non sono vincolanti: l'ordine diventa definitivo solo dopo la conferma della società.$$),
('condizioni_privati', 1, 'Condizioni di vendita per i privati', true,
$$**TESTO PROVVISORIO – da sostituire con le condizioni validate da un legale (Codice del Consumo).**

L'area Privati non è ancora attiva.$$);

-- Fasce di sconto per scadenza (docs/REGOLE_COMMERCIALI.md §2), modificabili dall'admin
insert into public.fasce_sconto (mesi_minimi, sconto_percentuale) values (8, 38), (6, 40), (0, 45);

-- Modalità di pagamento iniziali (docs/REGOLE_COMMERCIALI.md §6), modificabili dall'admin
insert into public.modalita_pagamento (codice, descrizione, canale, richiede_iban, contrassegno, ordine) values
  ('bonifico_anticipato', 'Bonifico bancario anticipato', 'farmacie', true, false, 10),
  ('riba_30', 'RIBA 30 giorni', 'farmacie', false, false, 20),
  ('riba_60', 'RIBA 60 giorni', 'farmacie', false, false, 30),
  ('riba_90', 'RIBA 90 giorni', 'farmacie', false, false, 40),
  ('contrassegno', 'Contrassegno', 'farmacie', false, true, 50);
-- Modalità di pagamento per i privati (docs/AREA_PRIVATI.md §6). La carta online è predisposta ma non attiva.
insert into public.modalita_pagamento (codice, descrizione, canale, richiede_iban, contrassegno, attiva, ordine) values
  ('bonifico_privati', 'Bonifico bancario anticipato', 'privati', true, false, true, 110),
  ('contrassegno_privati', 'Contrassegno (pagamento alla consegna)', 'privati', false, true, true, 120),
  ('carta_online', 'Carta di pagamento online (non ancora attiva)', 'privati', false, false, false, 130);
-- ---------------------------------------------------------------------------
-- Base di conoscenza dell'assistente: FAQ di esempio sull'uso del portale (solo in locale).
-- Solo informazioni pratiche sul portale, nessuna informazione sui prodotti:
-- schede e FAQ vere le carica e approva il gruppo da Admin → Assistente → Base di conoscenza.
-- ---------------------------------------------------------------------------
with doc as (
  insert into public.kb_documenti (titolo, tipo, pubblico, testo, stato, approvato_il)
  values (
    'Uso del portale Magistra (esempio)',
    'faq',
    'farmacie',
    $kb$Come si invia un ordine? Si aggiungono al carrello i lotti scelti dal catalogo, poi dalla pagina Carrello si sceglie la società che fattura, la modalità di pagamento, si accettano le condizioni di vendita e si invia la prenotazione.

La prenotazione è vincolante? No: è una prenotazione non vincolante finché Sagè Pharma non la conferma. Se non viene confermata entro i giorni lavorativi indicati nelle condizioni, scade e la merce torna disponibile.

Dove trovo il riepilogo dell'ordine e il DDT? Nella pagina dell'ordine (I miei ordini) si scaricano il riepilogo in PDF ed Excel; dopo la spedizione si scarica anche il DDT simulato, che non è un documento fiscale.

Posso ordinare lotti di depositi diversi nello stesso ordine? No: ogni ordine parte da un solo deposito. Se il carrello contiene lotti di depositi diversi, il portale chiede di inviare un ordine per ogni deposito.

Come cambio i miei dati? Dalla pagina Il mio profilo si aggiornano recapiti e indirizzi; ragione sociale e partita IVA le modifica l'assistenza Magistra.$kb$,
    'approvato',
    now()
  )
  returning id, titolo, testo
)
insert into public.kb_frammenti (documento_id, posizione, testo)
select doc.id, p.n - 1, doc.titolo || E'\n' || p.paragrafo
from doc, regexp_split_to_table(doc.testo, E'\n\n') with ordinality as p(paragrafo, n);
