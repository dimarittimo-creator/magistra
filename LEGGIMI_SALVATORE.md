# Come avviare il progetto Magistra con Claude Code

1. **Estrai** questa cartella in un posto comodo, per esempio `Documenti/magistra`. Se avevi già estratto la versione precedente (`portale-farmacie`) e non hai ancora iniziato a lavorarci, cancellala e usa questa. Lo stesso vale per la versione `s-trading`.
2. **Apri l'app Claude** sul computer e scegli **Claude Code**.
3. **Seleziona la cartella** `magistra` come progetto.
4. **Copia e incolla** il testo del file `PRIMO_MESSAGGIO.txt` e invialo.
5. Segui le sue indicazioni: quando ti chiede di installare qualcosa o di approvare un'azione, leggi la spiegazione e conferma.

## Cosa c'è nella cartella
- `CLAUDE.md` – le regole che Claude Code legge ogni volta che apri il progetto.
- `docs/` – specifica, regole commerciali, società e sedi, area privati, architettura, deposito, import Excel, grafica, fasi, conformità, stato lavori.
- `dati/` – giacenza e listino di esempio, file di verifica dei prezzi.
- `design/` – logo Magistra, logo Sagè Pharma e pannello sconti di riferimento.

## Consigli
- Lavora una fase alla volta e prova tutto prima di dire "ok, prossima fase".
- Quando cambi una regola commerciale, diglielo esplicitamente e chiedigli di aggiornare il documento giusto in `docs/`.
- Gli account a pagamento (Supabase, Vercel, Brevo) servono solo per la messa online, nell'ultima fase.
- Quando arriva un nuovo file del deposito, puoi usarlo per provare l'import.
- L'area Privati resta spenta online finché non inserisci spese di spedizione e condizioni di vendita per i privati validate da un legale.
