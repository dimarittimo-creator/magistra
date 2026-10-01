# Backup e ripristino

## Cosa c'è
- **Backup giornalieri automatici** di Supabase (piano Pro): copia completa del database ogni notte, conservata 7 giorni. Verificati attivi il 01/10/2026 (`npx supabase backups list --project-ref lepykbcqppnqrintlcmu`).
- **Copia manuale sul computer** con `scripts/backup-produzione.ps1`: crea `Documenti\Magistra-backup\<data>\schema.sql` e `dati.sql`. Contiene dati personali e IBAN: **mai su GitHub**, conservarla anche su un supporto esterno o cloud aziendale.
- **Codice**: su GitHub (`dimarittimo-creator/magistra`); ogni versione pubblicata resta anche su Vercel.
- Il ripristino "a un minuto preciso" (PITR) è un servizio aggiuntivo a pagamento di Supabase: non attivo, da valutare quando gli ordini saranno numerosi.

## Prova di ripristino (01/10/2026)
Copia manuale del database online ricaricata in un database temporaneo separato: dati identici all'originale (società con IBAN, sedi, 47 prodotti, 64 lotti, 90.297 pezzi, utenti, pagamenti), 42 tabelle su 42 con Row Level Security, 76 regole di sicurezza. Database temporaneo poi eliminato.

## Come si ripristina
**Errore recente (es. dati cancellati per sbaglio oggi):**
1. Supabase → progetto `magistra` → **Database → Backups**.
2. Scegliere il backup del giorno prima del problema → **Restore**.
   Attenzione: il database torna com'era quel giorno; ordini e iscrizioni successivi vanno reinseriti. Il sito resta irraggiungibile per qualche minuto.
3. Avvisare l'amministrazione e controllare gli ordini delle ultime ore (le email inviate restano nella casella).

**Copia manuale** (se il progetto Supabase non fosse disponibile): creare un nuovo progetto a Francoforte, applicare `schema.sql` e poi `dati.sql` con `psql`, aggiornare su Vercel le variabili `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e ripubblicare. Da fare con assistenza tecnica.

## Buona abitudine
Una copia manuale al mese e prima di ogni operazione importante (import massivi, cambi di listino, aggiornamenti grossi del portale).
