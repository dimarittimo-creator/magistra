// Crea un utente amministratore.
// Uso:  npm run crea-admin -- nome@dominio.it "Nome Cognome"
// La password generata si mostra una sola volta: va cambiata al primo accesso
// (link "Password dimenticata?" nella pagina di accesso).
import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const [email, nome] = process.argv.slice(2);
if (!email || !email.includes("@")) {
  console.error('Uso: npm run crea-admin -- nome@dominio.it "Nome Cognome"');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !chiave) {
  console.error("Configurazione mancante: servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

function generaPassword(lunghezza = 14) {
  const lettere = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const cifre = "23456789";
  const tutti = lettere + cifre;
  let p = lettere[randomInt(lettere.length)] + cifre[randomInt(cifre.length)];
  while (p.length < lunghezza) p += tutti[randomInt(tutti.length)];
  return p;
}

const db = createClient(url, chiave, { auth: { persistSession: false, autoRefreshToken: false } });
const password = generaPassword();

const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
if (error) {
  console.error(`Utente non creato: ${error.message}`);
  process.exit(1);
}

const { error: e2 } = await db
  .from("profili_utente")
  .insert({ id: data.user.id, ruolo: "admin", nome: nome || null, email });
if (e2) {
  await db.auth.admin.deleteUser(data.user.id);
  console.error(`Profilo non creato: ${e2.message}`);
  process.exit(1);
}

console.log(`Amministratore creato: ${email}`);
console.log(`Password provvisoria (mostrata solo ora): ${password}`);
