// Cancella i dati di prova approvati da Salvatore il 18/10/2026: farmacia 0100 "Bioeleva srl"
// e i suoi ordini P-2026-00001 e P-2026-00002; riporta la numerazione ordini 2026 a zero.
// Si ferma se trova dati diversi da quelli attesi. Fare prima scripts\backup-produzione.ps1.
// Online: powershell -ExecutionPolicy Bypass -File scripts\con-produzione.ps1 node scripts/cancella-dati-prova.mjs
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const ferma = (msg) => {
  console.error("FERMO: " + msg);
  process.exit(1);
};

const { data: farmacie } = await db.from("farmacie").select("id, codice_farmacia, ragione_sociale");
const prova = farmacie?.filter((f) => String(f.codice_farmacia) === "0100" || String(f.codice_farmacia) === "100") ?? [];
if (prova.length !== 1 || prova[0].ragione_sociale !== "Bioeleva srl") ferma("farmacia di prova non trovata come atteso");
const farmacia = prova[0];

const { data: ordini } = await db.from("ordini").select("id, numero, farmacia_id");
const numeri = (ordini ?? []).map((o) => o.numero).sort();
if (JSON.stringify(numeri) !== JSON.stringify(["P-2026-00001", "P-2026-00002"])) ferma(`ordini diversi dal previsto: ${numeri.join(", ")}`);
if (ordini.some((o) => o.farmacia_id !== farmacia.id)) ferma("un ordine non è della farmacia di prova");

// 1. Ordini (righe, storico stati, spedizioni si cancellano a cascata)
const { error: eOrd } = await db.from("ordini").delete().in("id", ordini.map((o) => o.id));
if (eOrd) ferma("cancellazione ordini: " + eOrd.message);
console.log("Cancellati ordini: " + numeri.join(", "));

// 2. Accessi collegati alla farmacia (il profilo si cancella con l'utente)
const { data: profili } = await db.from("profili_utente").select("id").eq("farmacia_id", farmacia.id);
for (const p of profili ?? []) {
  const { error } = await db.auth.admin.deleteUser(p.id);
  if (error) ferma("cancellazione accesso: " + error.message);
}
console.log(`Cancellati accessi: ${profili?.length ?? 0}`);

// 3. Farmacia (indirizzi, conversazioni e collegati a cascata)
const { error: eFar } = await db.from("farmacie").delete().eq("id", farmacia.id);
if (eFar) ferma("cancellazione farmacia: " + eFar.message);
console.log("Cancellata farmacia: " + farmacia.codice_farmacia + " " + farmacia.ragione_sociale);

// 4. Numerazione: il primo ordine vero sarà P-2026-00001
const { error: eNum } = await db.from("numerazione_ordini").delete().eq("anno", 2026);
if (eNum) ferma("numerazione: " + eNum.message);
console.log("Numerazione ordini 2026 azzerata.");
