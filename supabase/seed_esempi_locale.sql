-- Dati SOLO per il database locale (mai in produzione): esempi utili per provare il portale.

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
