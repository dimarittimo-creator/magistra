# Grafica e marchio

## Nome e intestazione

- Il portale si chiama **Magistra**, con pay off **"Semplicemente Magistrale"** (decisione di Salvatore Di Marino del 29/09/2026).
- Logo del portale: `design/logo_magistra.jpg` (1024×1024, fondo bianco, scritta corsiva blu con linea e stellina color rame, pay off già incluso sotto). Ritaglialo sull'area utile (niente bordi bianchi vuoti) e ricavane anche una versione PNG a fondo trasparente per l'intestazione e una favicon (la "M" o la stellina).
- Intestazione del sito: logo Magistra a sinistra; se lo spazio è poco (smartphone) mostra il logo senza pay off e il testo "Semplicemente Magistrale" come riga separata in `muted`, oppure nascondilo. Sotto o accanto, in piccolo, "Sagè Pharma · Bioeleva" in `muted`.
- Il pay off compare anche: nella home (sotto il logo, grande), nel titolo della pagina del browser ("Magistra – Semplicemente Magistrale"), nel piè di pagina del sito e delle email.
- Nei documenti d'ordine (PDF, Excel, DDT simulato) l'intestazione resta quella della **società che fattura** (logo Sagè Pharma o Bioeleva); il logo Magistra va solo in piccolo nel piè di pagina ("Ordine effettuato tramite Magistra").
- **Stessi colori aziendali per entrambe le società** (palette qui sotto, ricavata dal logo Sagè Pharma).
- Logo società: `design/logo_sage_pharma.jpg` (fondo bianco) nei documenti e nelle email degli ordini fatturati da Sagè Pharma; per Bioeleva `design/logo_bioeleva.png` (fornito il 30/09/2026; nel portale `public/brand/logo-bioeleva.png` e la versione leggera per i documenti). Mostra i loghi sempre su una fascia bianca, anche in modalità scura.
- Spazi dedicati a Bioeleva predisposti (vedi `SOCIETA_E_SEDI.md` §3), stessa palette.
- Riferimento visivo approvato: `design/riferimento_pannello_sconti.html` (aprilo nel browser). Nel riferimento i pulsanti sono rossi: vanno resi in blu `brand` come da tabella colori. I testi "Sagè Pharma" nel riferimento vanno letti come "Magistra"; vale la resa grafica.
- Mostra il logo Magistra sempre su fondo bianco o chiaro; in modalità scura usa una fascia bianca per l'intestazione oppure una versione del logo in bianco.

## Colori (ricavati dal logo)

| Token | Chiaro | Scuro | Uso |
|---|---|---|---|
| `brand` | `#022976` | `#8FA8E0` | **Pulsanti principali**, link, bordo di focus, voce di menu attiva (blu Magistra; in modalità scura il testo dei pulsanti è `#0B1A3A`) |
| `brand-hover` | `#0A3A9A` | `#AFC2EA` | Pulsanti al passaggio del mouse / premuti |
| `danger` | `#D4200A` | `#FF5A42` | Avvisi importanti, difformità, errori, "Mancante temporaneamente" (rosso Sagè Pharma, mai per i pulsanti normali) |
| `danger-logo` | `#FF2207` | `#FF5A42` | Solo elementi grafici grandi (non testo piccolo: contrasto insufficiente) |
| `slate` | `#4E676E` | `#9FB6BD` | Stato "Disponibile", valori modificati a mano |
| `slate-logo` | `#6B8289` | `#8FA6AD` | Elementi grafici, sottotitoli grandi |
| `ink` | `#1D2427` | `#E8ECEE` | Testo |
| `muted` | `#5A6A70` | `#9EABB0` | Testo secondario |
| `bg` / `surface` | `#F6F7F7` / `#FFFFFF` | `#15191B` / `#1D2326` | Sfondi |
| `line` | `#DFE4E6` | `#2E373B` | Bordi |
| `amber` | `#9A6200` | `#E4B25A` | Prezzo mancante, attenzione |
| `magistra-blu` | `#022976` | `#8FA8E0` | Colore del marchio Magistra (uguale a `brand`): logo, titoli della home, intestazione, piè di pagina |
| `magistra-rame` | `#B0652A` | `#D99A62` | Dettagli decorativi (stellina, linee sottili sotto i titoli); non per testo piccolo |

Decisione del 29/09/2026: **pulsanti in blu Magistra**. Il rosso resta solo per avvisi, errori e difformità (`danger`); stati e fasce di sconto restano come indicato. Pulsanti secondari: bordo e testo `brand` su fondo `surface`. Contrasto AA verificato: bianco su `#022976` e `#0B1A3A` su `#8FA8E0`.

Fasce di sconto: fascia 1 `#6B8289`, fascia 2 `#E0913A`, fascia 3 `#FF2207` (il colore si intensifica con lo sconto).

## Caratteri

- Titoli: **Tinos** (Google Fonts, simile al carattere con grazie del logo), peso normale.
- Testo, tabelle, numeri: **Public Sans** con cifre tabulari.

## Principi

- Area Farmacie: interfaccia da strumento di lavoro, pulita, densa quanto serve, leggibile su tablet.
- Area Privati: stessa palette e caratteri, ma più ariosa e da negozio online, pensata prima per smartphone.
- I prezzi farmacia IVA esclusa sono il dato più importante: in grassetto.
- Stati con etichette colorate brevi e sempre accompagnate da testo (mai solo colore).
- Accessibilità: contrasto AA, focus visibile da tastiera, rispetto di "riduci movimento".
