// Import iniziale di giacenza del deposito e listino sul deposito predefinito.
// Uso: npm run importa-dati [-- giacenza.xls listino.xlsx gg-mm-aaaa]
// Senza argomenti usa i file di esempio in dati/. Di norma l'import si fa da Amministrazione → Magazzino.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { applicaImport, creaImport } from "../lib/import/applica";
import { dataDaNomeFile, leggiGiacenzaDeposito } from "../lib/import/giacenza";
import { leggiListino } from "../lib/import/listino";

const [fileGiacenza = "dati/giacenza_esempio_21-09-2026.xls", fileListino = "dati/listino_esempio.xlsx", dataArg] = process.argv.slice(2);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chiave) {
  console.error("Configurazione mancante: servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(url, chiave, { auth: { persistSession: false, autoRefreshToken: false } });

const dataGiacenza = dataArg ? dataDaNomeFile(dataArg) : dataDaNomeFile(basename(fileGiacenza));
if (!dataGiacenza) {
  console.error("Indica la data della giacenza (gg-mm-aaaa) come terzo argomento.");
  process.exit(1);
}
const { data: deposito } = await db.from("sedi").select("id, nome").eq("predefinito", true).single();
if (!deposito) {
  console.error("Nessun deposito predefinito nelle sedi.");
  process.exit(1);
}

const giacenza = leggiGiacenzaDeposito(readFileSync(fileGiacenza));
console.log(`Giacenza ${basename(fileGiacenza)} del ${dataGiacenza} → ${deposito.nome}`);
console.log(
  `  ${giacenza.totali.prodotti} prodotti, ${giacenza.totali.lotti} lotti, ${giacenza.totali.pezzi.toLocaleString("it-IT")} pezzi; ` +
    `${giacenza.totali.difformita} difformità, ${giacenza.totali.senza_scadenza} lotti senza scadenza`,
);
for (const e of giacenza.errori) console.log(`  ! riga ${e.riga}: ${e.messaggio}`);
const contenutoG = { tipo: "deposito_crystal" as const, giacenza };
const idG = await creaImport(db, { tipo: "deposito_crystal", fileNome: basename(fileGiacenza), depositoId: deposito.id, dataGiacenza, contenuto: contenutoG, riepilogo: giacenza.totali });
for (const a of await applicaImport(db, { id: idG, tipo: "deposito_crystal", deposito_id: deposito.id, data_giacenza: dataGiacenza, contenuto: contenutoG })) console.log(`  · ${a}`);

const listino = await leggiListino(readFileSync(fileListino));
console.log(`Listino ${basename(fileListino)}: ${listino.voci.length} prezzi`);
for (const e of listino.errori) console.log(`  ! riga ${e.riga}: ${e.messaggio}`);
const contenutoL = { tipo: "listino" as const, listino };
const idL = await creaImport(db, { tipo: "listino", fileNome: basename(fileListino), contenuto: contenutoL, riepilogo: { voci: listino.voci.length } });
await applicaImport(db, { id: idL, tipo: "listino", deposito_id: null, data_giacenza: null, contenuto: contenutoL });

const { count } = await db.from("prodotti").select("codice", { count: "exact", head: true }).is("prezzo_pubblico_cent", null);
console.log(`Fatto. Prodotti senza prezzo (non visibili alle farmacie): ${count}`);
