# Magistra – Portale ordini farmacie e privati (Sagè Pharma · Bioeleva)

_Pay off: "Semplicemente Magistrale". Logo: `design/logo_magistra.jpg`._

Stai costruendo **Magistra**, il portale commerciale del gruppo di Salvatore Di Marino per integratori alimentari. Il portale serve due società del gruppo, **Sagè Pharma S.r.l.** e **Bioeleva S.r.l.**, e ha due aree:

- **Area Farmacie (B2B):** le farmacie consultano la merce del deposito, scelgono lotti e condizioni e inviano **prenotazioni d'ordine non vincolanti**. L'ordine diventa definitivo solo dopo la conferma, poi viene trasmesso al deposito per la spedizione con DDT.
- **Area Privati (B2C):** i clienti privati ordinano a prezzo al pubblico con gli sconti del mese e le spese di spedizione.

In ogni ordine si indica **quale società fattura e consegna** (Sagè Pharma o Bioeleva). Dettagli in `docs/SOCIETA_E_SEDI.md`.

Ragiona come esperto di logistica e marketing farmaceutico e come sviluppatore full-stack senior.

## Con chi lavori

Il titolare, Salvatore Di Marino, **non è uno sviluppatore**. Quindi:
- scrivi sempre in italiano, in modo semplice e pratico;
- quando serve una sua azione (creare un account, copiare una chiave, cliccare in un pannello) dagli istruzioni passo passo, una cosa alla volta;
- non chiedergli di scegliere tra dettagli tecnici: decidi tu, seguendo questo file, e spiega in una riga cosa hai scelto;
- a fine di ogni fase avvia il sito in locale e digli esattamente cosa provare e con quali credenziali di test.

## Documenti da leggere prima di iniziare

1. `docs/SPECIFICA.md` – requisiti originali del committente.
2. `docs/REGOLE_COMMERCIALI.md` – prezzi, sconti, disponibilità, difformità, condizioni di vendita. **Vincolanti.**
3. `docs/SOCIETA_E_SEDI.md` – società emittenti, dati fiscali, sedi operative e depositi. **Vincolanti.**
4. `docs/AREA_PRIVATI.md` – area B2C, sconti mensili, spese di spedizione. **Vincolanti.**
5. `docs/ARCHITETTURA.md` – tecnologie, database, pagine.
6. `docs/DEPOSITO_E_SPEDIZIONI.md` – flusso verso il deposito e DDT.
7. `docs/IMPORT_EXCEL.md` – formato dei file del deposito e del listino.
8. `docs/GRAFICA.md` – marchio, colori, caratteri.
9. `docs/FASI.md` – ordine di sviluppo e criteri di accettazione.
10. `docs/CONFORMITA.md` – GDPR, AI Act, tutela del consumatore, sicurezza.

I file reali sono in `dati/`. `dati/verifica_prezzi_attesi.xlsx` contiene i prezzi farmacia attesi per ogni lotto: usalo nei test automatici del calcolo prezzi.

## Tecnologie (decise, non cambiarle senza motivo forte)

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS**, ultima versione stabile.
- **Supabase**: PostgreSQL in regione UE (Frankfurt), Auth, Storage, pgvector. Migrazioni SQL versionate in `supabase/migrations`. Row Level Security attiva su tutte le tabelle.
- **Vercel** per l'hosting, con Vercel Cron per i job pianificati.
- **ExcelJS** per import/export Excel; per i file `.xls` vecchio formato del deposito usa **SheetJS**.
- Generazione PDF lato server (es. `@react-pdf/renderer`).
- **Brevo** per le email transazionali (SMTP o API), mittente sul dominio aziendale.
- **Anthropic API** (SDK ufficiale) per il chatbot, solo dalla fase del chatbot.
- Test: **Vitest** per la logica (prezzi, disponibilità, import), **Playwright** per i flussi principali.

## Regole di lavoro

- Lavora **una fase alla volta** (vedi `docs/FASI.md`). Non iniziare la fase successiva senza l'ok di Salvatore.
- Prima di creare account o servizi a pagamento, chiedi. Per lo sviluppo usa Supabase in locale (Supabase CLI + Docker) o un progetto gratuito.
- Segreti solo in `.env.local` (mai nel repository). Mantieni aggiornato `.env.example`.
- La logica di prezzo, sconto e disponibilità vive in **un solo modulo** (`lib/pricing`, `lib/availability`), usato da catalogo farmacie, area privati, carrello, chatbot, PDF ed export. Mai duplicarla.
- Tutti gli importi in centesimi interi nel database; arrotondamento a 2 decimali per prezzo unitario, come in `docs/REGOLE_COMMERCIALI.md`.
- Ogni ordine salva una **fotografia** dei prezzi, sconti, dati del cliente, **dati fiscali della società emittente**, condizioni di vendita accettate e deposito di partenza al momento dell'invio.
- I dati delle società, le sedi, le condizioni di vendita, le modalità di pagamento, gli sconti privati e le spese di spedizione sono **dati modificabili dall'admin**, mai scritti nel codice.
- Ogni azione nell'area admin scrive nel registro operazioni.
- Interfaccia interamente in italiano, date `gg/mm/aaaa`, euro con virgola decimale.
- Responsive: deve funzionare bene su tablet al banco della farmacia e su smartphone per i privati.
- Aggiorna `docs/STATO_LAVORI.md` a fine sessione: cosa è fatto, cosa manca, come provarlo.
- Commit piccoli e descrittivi su Git.

## Ruoli

- `farmacia` – vede prezzi e disponibilità dei lotti solo se l'iscrizione è approvata.
- `privato` – cliente B2C: vede il catalogo privati con prezzi al pubblico e sconti del mese; non vede lotti, giacenze né prezzi farmacia.
- `admin` – gruppo Magistra, accesso completo.
- `operatore` – gestisce ordini e chat, non impostazioni commerciali né dati delle società.
- `deposito` – **predisposto ma non attivo**: in futuro vedrà solo gli ordini da preparare del proprio deposito, senza prezzi.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
