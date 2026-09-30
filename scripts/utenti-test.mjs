// Crea gli utenti di prova SOLO sul database locale (mai in produzione):
// un amministratore, una farmacia attiva e una farmacia in attesa di approvazione.
// Le password generate si scrivono in credenziali-test.txt (escluso dal repository).
// Uso: npm run db:utenti-test   (si può rieseguire: rigenera le password)
import { randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url) || !chiave) {
  console.error("Questo script funziona solo con il database locale (npm run db:start, poi npm run db:env).");
  process.exit(1);
}
const db = createClient(url, chiave, { auth: { persistSession: false, autoRefreshToken: false } });

function generaPassword(lunghezza = 12) {
  const lettere = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const cifre = "23456789";
  let p = lettere[randomInt(lettere.length)] + cifre[randomInt(cifre.length)];
  while (p.length < lunghezza) p += (lettere + cifre)[randomInt(lettere.length + cifre.length)];
  return p;
}

/** Partita IVA di prova con carattere di controllo corretto. */
function partitaIva(base10) {
  let somma = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(base10[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    somma += d;
  }
  return base10 + ((10 - (somma % 10)) % 10);
}

async function utente(email, password) {
  const { data: elenco } = await db.auth.admin.listUsers({ perPage: 1000 });
  const esistente = elenco?.users.find((u) => u.email === email);
  if (esistente) {
    await db.auth.admin.updateUserById(esistente.id, { password, email_confirm: true });
    return { id: esistente.id, nuovo: false };
  }
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { id: data.user.id, nuovo: true };
}

const indirizzo = (via, cap, citta, provincia) => ({ indirizzo: via, cap, citta, provincia, presso: "" });

const credenziali = [];

// Amministratore
{
  const email = "admin@magistra.test";
  const password = generaPassword();
  const u = await utente(email, password);
  if (u.nuovo) {
    const { error } = await db.from("profili_utente").insert({ id: u.id, ruolo: "admin", nome: "Amministratore di prova", email });
    if (error) throw error;
  }
  credenziali.push(["Amministratore", email, password]);
}

// Farmacie
const farmacie = [
  {
    email: "farmacia.attiva@magistra.test",
    stato: "attiva",
    dati: {
      ragione_sociale: "Farmacia Centrale di Prova S.n.c.",
      titolare: "Maria Rossi",
      partita_iva: partitaIva("0123456789"),
      sdi: "ABC1234",
      pec: "",
      telefono: "081 0000001",
    },
    consegna: indirizzo("Via Toledo, 1", "80134", "Napoli", "NA"),
  },
  {
    email: "farmacia.attesa@magistra.test",
    stato: "in_attesa",
    dati: {
      ragione_sociale: "Farmacia San Paolo di Prova",
      titolare: "Giuseppe Bianchi",
      partita_iva: partitaIva("0987654321"),
      sdi: "",
      pec: "farmaciasanpaolo@pec.esempio.it",
      telefono: "089 0000002",
    },
    consegna: indirizzo("Corso Vittorio Emanuele, 10", "84121", "Salerno", "SA"),
  },
];

for (const f of farmacie) {
  const password = generaPassword();
  const u = await utente(f.email, password);
  if (u.nuovo) {
    const dati = { ...f.dati, codice_fiscale: f.dati.partita_iva };
    const { data: id, error } = await db.rpc("registra_farmacia", {
      p_utente: u.id,
      p_email: f.email,
      p_farmacia: dati,
      p_consegna: f.consegna,
      p_fatturazione: f.consegna,
      p_marketing: false,
      p_ip: "127.0.0.1",
      p_user_agent: "script utenti-test",
    });
    if (error) throw error;
    if (f.stato === "attiva") {
      await db.from("farmacie").update({ stato: "attiva", approvata_il: new Date().toISOString() }).eq("id", id);
    }
  }
  credenziali.push([`Farmacia ${f.stato === "attiva" ? "attiva" : "in attesa"}`, f.email, password]);
}

// Cliente privato
{
  const email = "privato@magistra.test";
  const password = generaPassword();
  const u = await utente(email, password);
  if (u.nuovo) {
    const ind = { indirizzo: "Via Chiaia, 10", cap: "80121", citta: "Napoli", provincia: "NA", presso: "" };
    const { error } = await db.rpc("registra_privato", {
      p_utente: u.id,
      p_email: email,
      p_privato: { nome: "Mario", cognome: "Rossi", codice_fiscale: "RSSMRA85T10A562S", telefono: "333 0000003" },
      p_spedizione: ind,
      p_fatturazione: ind,
      p_marketing: false,
      p_ip: "127.0.0.1",
      p_user_agent: "script utenti-test",
    });
    if (error) throw error;
  }
  credenziali.push(["Cliente privato", email, password]);
}

const testo = [
  "CREDENZIALI DI PROVA – solo per il sito in locale (http://localhost:3000)",
  "Non usarle mai sul sito online. Rieseguendo «npm run db:utenti-test» le password cambiano.",
  "",
  ...credenziali.map(([ruolo, email, password]) => `${ruolo.padEnd(22)} email: ${email.padEnd(32)} password: ${password}`),
  "",
  "Email di prova ricevute dal portale: http://127.0.0.1:54324",
  "",
].join("\n");
writeFileSync("credenziali-test.txt", testo);
console.log("Utenti di prova pronti. Credenziali in credenziali-test.txt");
