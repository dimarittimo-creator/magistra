// Crea .env.local con le chiavi del Supabase locale (da eseguire dopo «npm run db:start»).
// Mantiene le altre variabili già presenti in .env.local.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const uscita = execSync("npx supabase status -o env", { encoding: "utf8" });
const stato = Object.fromEntries(
  uscita
    .split(/\r?\n/)
    .map((riga) => riga.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);

const url = stato.API_URL;
const anon = stato.PUBLISHABLE_KEY || stato.ANON_KEY;
const servizio = stato.SECRET_KEY || stato.SERVICE_ROLE_KEY;
if (!url || !anon || !servizio) {
  console.error("Non trovo le chiavi di Supabase. Il database locale è avviato? (npm run db:start)");
  process.exit(1);
}

const file = ".env.local";
const esistenti = existsSync(file) ? readFileSync(file, "utf8") : readFileSync(".env.example", "utf8");
const nuovi = {
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
  SUPABASE_SERVICE_ROLE_KEY: servizio,
};

let testo = esistenti;
for (const [chiave, valore] of Object.entries(nuovi)) {
  const re = new RegExp(`^${chiave}=.*$`, "m");
  testo = re.test(testo) ? testo.replace(re, `${chiave}=${valore}`) : `${testo.trimEnd()}\n${chiave}=${valore}\n`;
}
writeFileSync(file, testo);
console.log("Creato .env.local con le chiavi del Supabase locale.");
