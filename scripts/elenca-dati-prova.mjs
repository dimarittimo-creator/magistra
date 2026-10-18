// SOLO LETTURA: elenca farmacie, privati e ordini presenti nel database, per riconoscere i dati di prova.
// Online: powershell -ExecutionPolicy Bypass -File scripts\con-produzione.ps1 node scripts/elenca-dati-prova.mjs
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: farmacie, error: e1 } = await db
  .from("farmacie")
  .select("id, codice_farmacia, ragione_sociale, email, stato, creato_il")
  .order("creato_il");
if (e1) throw e1;
const { data: privati, error: e2 } = await db.from("privati").select("id, nome, cognome, email, stato, creato_il").order("creato_il");
if (e2) throw e2;
const { data: ordini, error: e3 } = await db
  .from("ordini")
  .select("id, numero, canale, stato, farmacia_id, privato_id, creato_il")
  .order("creato_il");
if (e3) throw e3;

console.log(`FARMACIE (${farmacie.length})`);
for (const f of farmacie) console.log(` ${f.codice_farmacia ?? "-"} | ${f.ragione_sociale} | ${f.email} | ${f.stato} | ${f.creato_il.slice(0, 10)}`);
console.log(`\nPRIVATI (${privati.length})`);
for (const p of privati) console.log(` ${p.nome} ${p.cognome} | ${p.email} | ${p.stato} | ${p.creato_il.slice(0, 10)}`);
console.log(`\nORDINI (${ordini.length})`);
const nome = (o) =>
  o.farmacia_id ? farmacie.find((f) => f.id === o.farmacia_id)?.ragione_sociale : (privati.find((p) => p.id === o.privato_id) ?? {}).email;
for (const o of ordini) console.log(` ${o.numero} | ${o.canale} | ${o.stato} | ${nome(o)} | ${o.creato_il.slice(0, 10)}`);
