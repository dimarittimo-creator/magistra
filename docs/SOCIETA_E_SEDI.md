# Società, sedi operative e depositi (vincolante)

Decisione di Salvatore Di Marino del 28/09/2026: il portale si chiama **Magistra** e serve due società del gruppo. In ogni ordine si sceglie **quale società fattura e consegna**.

## 1. Società emittenti

Tabella `societa`, modificabile solo dall'admin, con storico delle modifiche. Ogni ordine salva una fotografia dei dati della società al momento dell'invio.

Dati iniziali (visure camerali del 09/04/2026, confermati da Salvatore il 28/09/2026):

| Campo | Sagè Pharma | Bioeleva |
|---|---|---|
| Ragione sociale | SAGE' PHARMA S.r.l. | BIOELEVA S.r.l. |
| Nome breve (interfaccia) | Sagè Pharma | Bioeleva |
| Sede legale | Viale Antonio Gramsci, 21 – 80122 Napoli (NA) | Viale Antonio Gramsci, 21 – 80122 Napoli (NA) |
| Partita IVA / Codice fiscale | 01698370994 | 04363330277 |
| Codice univoco SDI | M5UXCR1 | M5UXCR1 |
| PEC | sagepharma1@pec.it | bioeleva@legalmail.it |
| REA | NA - 853582 | NA - 1108752 |
| Capitale sociale (testo libero) | € 100.000,00 (dicitura "i.v." da confermare) | € 13.612,00 i.v. |
| Sito | www.sagepharma.it | www.bioeleva.com |
| IBAN per bonifico | IBAN-RIMOSSO | IBAN-RIMOSSO |
| Logo | `design/logo_sage_pharma.jpg` | `design/logo_bioeleva.png` (fornito il 30/09/2026) |
| Attiva per farmacie / per privati | sì / sì | sì / sì |
| Predefinita | sì | no |

Campi aggiuntivi da prevedere: email amministrazione, telefono, testo piè di pagina documenti (vuoti finché non forniti).

IBAN: si inseriscono nei dati iniziali del database (seed), non nel codice sorgente pubblico. Compaiono quando la modalità di pagamento è il bonifico: nel riepilogo prima dell'invio, nell'email di conferma, nel PDF/Excel d'ordine e nella pagina "I miei ordini", sempre con la società che fattura (quindi l'IBAN cambia con la società scelta). Nell'interfaccia admin l'IBAN si modifica con controllo automatico di validità (lunghezza e cifre di controllo): un IBAN non valido non si salva. Se la società scelta non ha un IBAN valido, il bonifico non è selezionabile per quella società.

Regole:
- **Scelta per ordine:** nel carrello (farmacie e privati) un selettore "Fattura e consegna: Sagè Pharma / Bioeleva", con Sagè Pharma preselezionata. Mostra solo le società attive per quel canale; se è attiva una sola società il selettore non compare.
- L'admin può cambiare la società su un ordine finché non è stato inviato al deposito (con registro operazioni ed email al cliente).
- La società scelta compare su: riepilogo ordine, email, export Excel/PDF, DDT simulato (come mittente), richiesta di evasione al deposito, elenco "DDT da fatturare" (filtrabile per società) e report del valore distribuito (separato per società).
- Numerazione ordini unica per il portale (P-2026-00001), con la società indicata accanto.
- Una farmacia può avere una società predefinita (campo sulla farmacia, modificabile dall'admin), che precompila il selettore.

## 2. Sedi operative e depositi

Tabella `sedi`, gestita dall'admin: società, tipo (`legale` | `operativa` | `deposito`), nome, indirizzo, CAP, città, provincia, telefono, email, email in copia, referente, orari, attiva sì/no, note.

Sedi iniziali:

| Società | Tipo | Nome | Indirizzo |
|---|---|---|---|
| Sagè Pharma | legale | Sede legale Sagè Pharma | Viale Antonio Gramsci, 21 – 80122 Napoli (NA) |
| Sagè Pharma | operativa | Unità operativa amministrativa Guantai ad Orsolone (unità locale NA/5, aperta l'11/07/2024) | Via Comunale Guantai ad Orsolone, 40/B – 80131 Napoli (NA) |
| Sagè Pharma | deposito | Deposito CIENNE (predefinito) – gestito da NEW CIENNE DISTRIBUZIONE S.R.L. | Via Salvatore Piccolo, 211 – 80014 ASI Napoli (NA) |
| Bioeleva | legale | Sede legale Bioeleva | Viale Antonio Gramsci, 21 – 80122 Napoli (NA) |

Decisione del 29/09/2026: **la merce parte da CIENNE** (sede operativa di Via Salvatore Piccolo 211, ASI Napoli). Via Guantai ad Orsolone è un'unità operativa amministrativa: **non** è un luogo di partenza della merce e non compare sui DDT né nelle richieste di evasione. Le richieste di evasione vanno all'email di CIENNE (`sedi.email` = a.nuzzo@ciennegroup.it), telefono 081 18902097.

Regole:
- Un deposito appartiene a una società ma **può spedire per entrambe**. Bioeleva non ha un deposito proprio (in visura risulta attività "senza deposito"): quando fattura Bioeleva la merce parte dal deposito scelto, di default il deposito CIENNE.
- Ogni lotto importato è associato a un deposito (scelto al caricamento del file della giacenza; default il deposito predefinito).
- Le email di richiesta di evasione vanno agli indirizzi del **deposito di partenza** (non più a un indirizzo unico nelle impostazioni).
- Sul DDT simulato e sulla richiesta di evasione compare il luogo di partenza della merce.
- Se in futuro ci sono più depositi, un ordine usa un solo deposito; l'admin può spostarlo prima dell'invio al deposito. Il catalogo mostra la disponibilità sommata, i lotti restano distinti per deposito.
- Una sede disattivata non si cancella (serve allo storico degli ordini).

## 3. Spazi dedicati a Bioeleva (predisposti, non attivi)

Predisporre, attivabili dall'admin in seguito: logo Bioeleva nell'intestazione dei documenti quando fattura Bioeleva, pagina di presentazione Bioeleva, banner nel catalogo, filtro "prodotti Bioeleva". La grafica resta con i colori aziendali di `GRAFICA.md` per entrambe le società.

## 4. Operatore logistico del deposito

Dati forniti da Salvatore Di Marino il 29/09/2026. Tabella `operatori_logistici`, gestita dall'admin; ogni deposito in `sedi` può avere un operatore collegato (`sedi.operatore_id`).

| Campo | Valore |
|---|---|
| Ragione sociale | NEW CIENNE DISTRIBUZIONE S.R.L. (nome breve: CIENNE) |
| Partita IVA / Codice fiscale | 10664671210 |
| Sede legale | Centro Direzionale, Isola G1, Scala D, Int. 21 – 80143 Napoli (NA) |
| Sede operativa | Via Salvatore Piccolo, 211 – 80014 ASI Napoli (NA) |
| Email (destinatario richieste di evasione) | a.nuzzo@ciennegroup.it |
| PEC | newciennedistribuzione@pec.it |
| Telefono | 081 18902097 |
| Cellulare | 320 2171312 |

Regole:
- CIENNE prepara e spedisce la merce con DDT ma **non è il mittente fiscale**: sul DDT il mittente resta la società che fattura (Sagè Pharma o Bioeleva).
- Le email di richiesta di evasione, i solleciti DDT e l'invio cumulativo usano l'email del deposito, precompilata con quella di CIENNE; l'admin può aggiungere indirizzi in copia (`email_cc`).
- Il report "valore distribuito per mese" riporta l'operatore, così da controllare la fattura mensile di CIENNE (2% del distribuito).
- I dati di CIENNE compaiono nella richiesta di evasione (destinatario) ma non nei documenti inviati ai clienti.
