# Specifica originale del committente

> Le decisioni prese dopo questa specifica sono in `REGOLE_COMMERCIALI.md`, `SOCIETA_E_SEDI.md`, `AREA_PRIVATI.md` e `DEPOSITO_E_SPEDIZIONI.md` e **prevalgono** su questo testo in caso di differenze.
>
> Aggiornamento del 28/09/2026: il progetto si chiama **Magistra**; oltre alle farmacie c'è un'**area Privati (B2C)**; ogni ordine è fatturato e consegnato da **Sagè Pharma o Bioeleva**, a scelta; si gestiscono sedi operative e depositi delle società. Dove questo testo dice "Sagè Pharma" come venditore, leggi "la società scelta nell'ordine".

## Obiettivo
Le farmacie devono poter consultare la merce disponibile nel deposito, scegliere lotti e condizioni commerciali e inviare prenotazioni d'ordine non vincolanti per Sagè Pharma. L'ordine diventa definitivo solo dopo la conferma di Sagè Pharma. Un chatbot integrato assiste le farmacie nella consultazione e nell'ordine.

## 1. Registrazione e accesso farmacie
- Dati richiesti: ragione sociale, titolare, partita IVA e codice fiscale; codice identificativo della farmacia; indirizzo di consegna e di fatturazione; codice SDI o PEC; email e telefono.
- Ogni iscrizione resta in attesa finché non viene approvata manualmente. Solo le farmacie verificate vedono prezzi e disponibilità.
- Accesso con email e password, con recupero password.
- Area "Il mio profilo" dove la farmacia aggiorna i propri dati fiscali.
- All'iscrizione: consensi privacy (GDPR) e accettazione delle condizioni di vendita.

## 2. Catalogo e disponibilità
- Scheda prodotto: nome, formato, codice prodotto, immagine, prezzo di listino, aliquota IVA.
- Per ogni prodotto, elenco dei lotti disponibili con quantità in giacenza, data di scadenza e sconto associato.
- Filtri e ricerca per prodotto, linea e area terapeutica.
- Indicazione chiara dei prodotti in esaurimento o non disponibili.
- La quantità prenotata viene sottratta dalla disponibilità visibile, così due farmacie non prenotano la stessa merce.
- Se non confermata entro X giorni, la prenotazione scade e la merce torna disponibile.

## 3. Carrello e prenotazione
- Per ogni prodotto la farmacia sceglie lotto, quantità (rispettando l'eventuale minimo per prodotto) e modalità di pagamento: bonifico anticipato, RIBA 30/60/90 giorni, contrassegno o altre modalità configurabili.
- Tipi di sconto: sconto in fattura, sconto merce (es. 10+2), omaggi.
- Riepilogo prima dell'invio con imponibile, sconti, IVA e totale.
- Eventuale soglia minima d'ordine e soglia per il trasporto gratuito.
- Note libere e data di consegna desiderata.
- Stati visibili alla farmacia (estesi in `DEPOSITO_E_SPEDIZIONI.md`).
- Notifica email a ogni cambio di stato.
- Storico ordini con "ripeti ordine".

## 4. Documenti per la farmacia
- Export dell'ordine in Excel e PDF con tutti i dati fiscali della farmacia.
- Simulazione del DDT con mittente e destinatario; prodotti, lotti e scadenze; quantità, prezzi unitari e sconti; IVA e totali; dicitura evidente **"Documento non valido ai fini fiscali – prenotazione non vincolante"**.
- Dopo la spedizione, la farmacia scarica anche il DDT reale del deposito.

## 5. Area amministrazione
- **Magazzino:** import/export Excel di prodotti, lotti, scadenze, giacenze e prezzi; file modello scaricabile; controllo errori e anteprima delle modifiche prima del caricamento.
- **Ordini:** elenco con filtri per stato, farmacia e periodo; conferma, modifica o rifiuto con messaggio alla farmacia; export Excel.
- **Farmacie:** approvazione iscrizioni, blocco account, assegnazione a gruppi o listini dedicati (es. clienti storici, catene).
- **Promozioni:** stagionali, mensili o a tempo, con inizio e fine e attivazione automatica; applicabili a prodotto, lotto, linea, catalogo o gruppo di farmacie; "duplica promozione"; calendario delle promozioni attive e programmate.
- **Cruscotto:** ordini del periodo, prodotti più richiesti, lotti in scadenza, farmacie più attive.

## 6. Chatbot di assistenza
- Chat sempre visibile nell'area riservata, attiva 24/7.
- Risponde sui prodotti usando **solo** le informazioni fornite da Sagè Pharma: composizione, formato, posologia, avvertenze, materiale informativo.
- Consulta in tempo reale disponibilità, lotti, scadenze, promozioni attive e stato degli ordini della farmacia collegata.
- Aiuta a compilare l'ordine (es. "aggiungi 10 confezioni del lotto con lo sconto migliore"), chiedendo **sempre conferma** prima di inserire nel carrello.
- Risponde a domande pratiche: pagamenti, tempi di consegna, soglie, download del DDT simulato.
- Se non conosce la risposta non inventa: passa la conversazione a un operatore, che riceve la richiesta via email o in un pannello e risponde nella stessa chat.
- Non fornisce consigli medici su singoli pazienti.
- Admin: caricamento contenuti (schede, FAQ, documenti), storico conversazioni, domande frequenti e senza risposta.
- Conversazioni salvate nel rispetto del GDPR, con informativa visibile all'apertura.
- Predisposizione per una futura versione vocale, riutilizzando la base di conoscenza prodotti dell'assistente per i medici.

## 7. Requisiti tecnici
- Responsive, usabile da tablet al banco.
- HTTPS, password cifrate, backup dei dati.
- Registro delle operazioni nell'area amministrazione.
- Interfaccia in italiano, grafica coerente con il marchio Sagè Pharma.
