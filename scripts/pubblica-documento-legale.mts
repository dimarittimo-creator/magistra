// Pubblica una nuova versione DEFINITIVA di un testo legale (come Admin → Condizioni e privacy),
// a nome dell'amministratore indicato, con registrazione nel registro operazioni.
// Uso (produzione):
//   powershell -ExecutionPolicy Bypass -File scripts\con-produzione.ps1 npx.cmd tsx scripts/pubblica-documento-legale.mts <tipo> "<titolo>" <file.md> <email-admin>
// tipo: privacy | condizioni_farmacie | condizioni_privati. Il testo usa il formato del portale (paragrafi, **grassetto**).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [tipo, titolo, file, emailAdmin] = process.argv.slice(2);
if (!["privacy", "condizioni_farmacie", "condizioni_privati"].includes(tipo) || !titolo || !file || !emailAdmin) {
  console.error('Uso: … <privacy|condizioni_farmacie|condizioni_privati> "<titolo>" <file.md> <email-admin>');
  process.exit(1);
}
const testo = readFileSync(file, "utf8").trim();
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const { data: admin } = await db.from("profili_utente").select("id").eq("email", emailAdmin).eq("ruolo", "admin").single();
if (!admin) throw new Error(`Amministratore ${emailAdmin} non trovato`);
const { data: ultima } = await db.from("documenti_legali").select("versione, testo").eq("tipo", tipo).order("versione", { ascending: false }).limit(1).maybeSingle();
if (ultima?.testo === testo) {
  console.log(`Il testo è uguale alla versione ${ultima.versione}: niente da pubblicare.`);
  process.exit(0);
}
const versione = (ultima?.versione ?? 0) + 1;
const { data, error } = await db
  .from("documenti_legali")
  .insert({ tipo, versione, titolo, testo, provvisorio: false, in_vigore_dal: new Date().toISOString(), creato_da: admin.id })
  .select("id")
  .single();
if (error) throw error;
await db.from("registro_operazioni").insert({ utente: admin.id, azione: "pubblica_documento_legale", entita: "documenti_legali", entita_id: data.id, dopo: { tipo, versione, titolo } });
console.log(`Pubblicata la versione ${versione} di ${tipo} (${testo.length} caratteri).`);
