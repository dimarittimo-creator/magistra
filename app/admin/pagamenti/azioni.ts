"use server";

import { revalidatePath } from "next/cache";
import { richiediAdmin } from "@/lib/auth";
import { leggi, valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { registraOperazione } from "@/lib/registro";
import { creaClientServer } from "@/lib/supabase/server";

const CANALI = ["farmacie", "privati", "entrambi"];

export async function salvaModalita(id: string | null, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const valori = valoriModulo(fd);
  const errori: Record<string, string> = {};
  const costo = Math.round(Number(leggi(fd, "costo_aggiuntivo").replace(",", ".") || "0") * 100);
  const dati = {
    descrizione: leggi(fd, "descrizione"),
    canale: leggi(fd, "canale"),
    richiede_iban: Boolean(fd.get("richiede_iban")),
    contrassegno: Boolean(fd.get("contrassegno")),
    costo_aggiuntivo_cent: costo,
    attiva: id ? Boolean(fd.get("attiva")) : true,
    ordine: Number(leggi(fd, "ordine") || "0"),
  };
  if (!dati.descrizione) errori.descrizione = "Indica il nome della modalità";
  if (!CANALI.includes(dati.canale)) errori.canale = "Scegli il canale";
  if (!Number.isFinite(costo) || costo < 0) errori.costo_aggiuntivo = "Importo non valido";
  if (!Number.isInteger(dati.ordine)) errori.ordine = "Numero intero";
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlla i campi evidenziati." };

  const db = await creaClientServer();
  const codice = dati.descrizione.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  const { data: prima } = id ? await db.from("modalita_pagamento").select("*").eq("id", id).single() : { data: null };
  const { data, error } = id
    ? await db.from("modalita_pagamento").update(dati).eq("id", id).select("id").single()
    : await db.from("modalita_pagamento").insert({ ...dati, codice: `${codice}_${Date.now().toString(36)}` }).select("id").single();
  if (error) return { valori, messaggio: "Salvataggio non riuscito. Riprova." };
  await registraOperazione(db, utente.id, { azione: id ? "modifica_pagamento" : "crea_pagamento", entita: "modalita_pagamento", entitaId: data.id, prima, dopo: dati });
  revalidatePath("/admin/pagamenti");
  return { ok: true, messaggio: id ? "Modalità salvata." : "Modalità creata." };
}

export async function aggiungiLimite(modalitaId: string, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const destinatario = leggi(fd, "destinatario"); // "g:<id>" oppure "f:<id>"
  const [tipo, id] = destinatario.split(":");
  if (!id || (tipo !== "g" && tipo !== "f")) return { messaggio: "Scegli un gruppo o una farmacia." };
  const riga = { modalita_id: modalitaId, gruppo_id: tipo === "g" ? id : null, farmacia_id: tipo === "f" ? id : null };
  const db = await creaClientServer();
  const { error } = await db.from("modalita_pagamento_limiti").insert(riga);
  if (error) return { messaggio: error.code === "23505" ? "Già presente." : "Salvataggio non riuscito." };
  await registraOperazione(db, utente.id, { azione: "aggiungi_limite_pagamento", entita: "modalita_pagamento", entitaId: modalitaId, dopo: riga });
  revalidatePath("/admin/pagamenti");
  return { ok: true };
}

export async function rimuoviLimite(limiteId: string) {
  const utente = await richiediAdmin();
  const db = await creaClientServer();
  const { data: prima } = await db.from("modalita_pagamento_limiti").select("*").eq("id", limiteId).single();
  await db.from("modalita_pagamento_limiti").delete().eq("id", limiteId);
  await registraOperazione(db, utente.id, { azione: "rimuovi_limite_pagamento", entita: "modalita_pagamento", entitaId: prima?.modalita_id, prima });
  revalidatePath("/admin/pagamenti");
}
