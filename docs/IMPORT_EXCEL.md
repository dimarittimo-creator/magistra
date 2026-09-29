# Import Excel

Ogni import segue lo stesso flusso: **carica → controlla errori → anteprima delle differenze → conferma → applica**. Niente viene scritto prima della conferma. Tutto finisce in `import_magazzino` e nel registro operazioni.

## 1. Giacenza del deposito (export Crystal Reports, `.xls`)

Esempio: `dati/giacenza_esempio_21-09-2026.xls` (foglio `Sheet1`). Va letto **così com'è**, senza chiedere di riformattarlo.

Colonne: `Codice | Descrizione | Giacenza | LottoGiac. | Lotto | DataScadenza | Azienda produttrice`

Struttura per ogni prodotto:
- **prima riga lotto:** codice, descrizione, giacenza totale del prodotto (col. C), quantità del lotto (col. D), codice lotto, scadenza, codice interno (col. G);
- **altre righe lotto:** stesso codice e descrizione, col. C vuota, quantità lotto in D;
- **riga di subtotale:** col. A = differenza tra totale e somma lotti (0 se coincidono, es. `-3`), col. B = somma dei lotti, altre colonne vuote;
- ultima riga del file: `Pagina -1 di 1` → ignorare.

Regole di parsing:
- codice = minsan a 9 cifre (numero → stringa, conserva gli zeri iniziali se presenti);
- scadenza: data; un valore vuoto o solo orario (`00:00:00`) = **nessuna scadenza** → lotto "Mancante";
- codici lotto: conservali esattamente come sono (maiuscole/minuscole incluse);
- difformità se somma lotti ≠ col. C → prodotto "Mancante temporaneamente" (vedi `REGOLE_COMMERCIALI.md`);
- la data della giacenza si chiede all'admin al caricamento (proponi quella nel nome del file, es. `21-09-2026`);
- al caricamento l'admin sceglie anche **il deposito** a cui si riferisce il file (default: deposito predefinito, oggi il deposito CIENNE di Via Salvatore Piccolo 211, ASI Napoli). I lotti importati appartengono a quel deposito; un nuovo import aggiorna solo quel deposito.

Controlli e avvisi in anteprima: codici non presenti nel catalogo (crearli come non visibili), lotti scaduti, lotti senza scadenza, difformità, prodotti in catalogo spariti dal file (giacenza a 0), giacenza sotto l'impegnato.

Dati attesi dal file di esempio: 47 prodotti, 64 lotti, 90.297 pezzi da lotti; 1 difformità (ELIVID), 2 lotti senza scadenza (Riparase crema, Riparase Plus). Scrivi un test che lo verifichi.

## 2. Listino (`.xlsx`)

Esempio: `dati/listino_esempio.xlsx`, foglio `Stima Chiusura 2026`.
Colonne: A = codice minsan, B = nome, C = nome alternativo, D = **prezzo al pubblico IVA inclusa** (colonna senza intestazione). Ultima riga `TOTALE` → ignorare.

8 prodotti della giacenza di esempio non sono nel listino (Infantuss, Niagara, Omegarex, Regeneris, Riparase crema, Riparase Plus, Sparta Pappa Reale, Vitabim): restano non visibili finché non hanno un prezzo.

## 3. Modello pulito (scaricabile dall'admin)

Un solo foglio, una riga per lotto:
`Codice | Prodotto | Formato | Linea | Area terapeutica | Prezzo al pubblico IVA incl. | IVA % (vuoto = predefinita) | Visibile privati (sì/no) | Deposito | Lotto | Scadenza (gg/mm/aaaa) | Quantità lotto | Giacenza totale prodotto | Sconto lotto % (vuoto = fascia)`

Con legenda e una riga di esempio. Lo stesso formato si usa per l'export del magazzino.

## 4. Verifica dei prezzi

`dati/verifica_prezzi_attesi.xlsx` contiene, per ogni lotto, lo stato e i quattro prezzi calcolati con le regole attuali alla data del 28/09/2026. Usalo come dato di test: il modulo `lib/pricing` deve dare gli stessi risultati a parità di data di riferimento.
