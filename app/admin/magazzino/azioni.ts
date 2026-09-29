"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { richiediAdmin } from "@/lib/auth";
import { oggiRoma } from "@/lib/date";
import { leggi, type StatoModulo } from "@/lib/farmacie/dati";
import { calcolaAnteprima } from "@/lib/import/anteprima";
import { applicaImport, creaImport, type ContenutoImport, type RigaImport } from "@/lib/import/applica";
import { leggiGiacenzaDeposito } from "@/lib/import/giacenza";
import { leggiListino } from "@/lib/import/listino";
import { leggiModello } from "@/lib/import/modello";
import { registraOperazione } from "@/lib/registro";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";

const TIPI = ["deposito_crystal", "listino", "modello"] as const;

/** Legge il file, prepara l'anteprima e la salva: nulla cambia nel magazzino fino alla conferma. */
export async function caricaFile(_prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const tipo = leggi(fd, "tipo") as (typeof TIPI)[number];
  const file = fd.get("file");
  const depositoId = leggi(fd, "deposito_id") || null;
  const dataGiacenza = leggi(fd, "data_giacenza") || null;
  const errori: Record<string, string> = {};

  if (!TIPI.includes(tipo)) errori.tipo = "Scegli il tipo di file";
  if (!(file instanceof File) || file.size === 0) errori.file = "Scegli il file da caricare";
  if (tipo === "deposito_crystal" && !depositoId) errori.deposito_id = "Scegli il deposito a cui si riferisce la giacenza";
  if (tipo !== "listino" && (!dataGiacenza || !/^\d{4}-\d{2}-\d{2}$/.test(dataGiacenza))) errori.data_giacenza = "Indica la data della giacenza";
  if (Object.keys(errori).length) return { errori, messaggio: "Controlla i campi evidenziati." };

  const f = file as File;
  const buffer = new Uint8Array(await f.arrayBuffer());
  const db = creaClientAdmin();
  let contenuto: ContenutoImport;
  try {
    if (tipo === "deposito_crystal") {
      const giacenza = leggiGiacenzaDeposito(buffer);
      if (giacenza.totali.prodotti === 0) return { errori: { file: "Nel file non ho trovato righe di giacenza: è l'export del deposito?" } };
      contenuto = { tipo, giacenza };
    } else if (tipo === "listino") {
      const listino = await leggiListino(buffer);
      if (!listino.voci.length) return { errori: { file: "Nel file non ho trovato prezzi: controlla che le colonne siano Codice, Nome, Nome alternativo, Prezzo" } };
      contenuto = { tipo, listino };
    } else {
      const modello = await leggiModello(buffer);
      if (!modello.prodotti.length) return { errori: { file: "Nel file non ho trovato prodotti: usa il modello scaricabile da questa pagina" } };
      const { data: depositi } = await db.from("sedi").select("id, nome").eq("tipo", "deposito");
      const perNome = new Map((depositi ?? []).map((d) => [String(d.nome).toLowerCase(), d.id as string]));
      const mappa: Record<string, string> = {};
      const sconosciuti: string[] = [];
      for (const nome of new Set(modello.prodotti.flatMap((p) => p.lotti.map((l) => l.deposito)))) {
        const id = perNome.get(nome.toLowerCase());
        if (id) mappa[nome] = id;
        else sconosciuti.push(nome);
      }
      if (sconosciuti.length) return { errori: { file: `Depositi non trovati nelle sedi: ${sconosciuti.join(", ")}` } };
      contenuto = { tipo, modello, depositi: mappa };
    }
  } catch (e) {
    console.error("[import] file non leggibile:", e);
    return { errori: { file: "Non riesco a leggere il file: è un file Excel del tipo indicato?" } };
  }

  const anteprima = await calcolaAnteprima(db, contenuto, { depositoId, oggi: oggiRoma() });
  const id = await creaImport(db, {
    tipo,
    fileNome: f.name,
    depositoId: tipo === "deposito_crystal" ? depositoId : null,
    dataGiacenza: tipo === "listino" ? null : dataGiacenza,
    contenuto,
    riepilogo: anteprima,
    utente: utente.id,
  });
  redirect(`/admin/magazzino/import/${id}`);
}

export async function confermaImport(id: string): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const admin = creaClientAdmin();
  const { data } = await admin.from("import_magazzino").select("id, tipo, deposito_id, data_giacenza, contenuto, stato, file_nome").eq("id", id).maybeSingle();
  if (!data || data.stato !== "anteprima") return { messaggio: "Questo import non è più in anteprima." };
  try {
    const avvisi = await applicaImport(admin, data as unknown as RigaImport);
    const db = await creaClientServer();
    await registraOperazione(db, utente.id, { azione: "applica_import", entita: "import_magazzino", entitaId: id, dopo: { file: data.file_nome, tipo: data.tipo, avvisi } });
  } catch (e) {
    console.error("[import] applicazione non riuscita:", e);
    return { messaggio: "Import interrotto: una parte dei dati potrebbe essere già aggiornata. Ricarica lo stesso file per completarlo; se l'errore si ripete contatta l'assistenza." };
  }
  revalidatePath("/admin/magazzino", "layout");
  return { ok: true, messaggio: "Import applicato: catalogo e disponibilità sono aggiornati." };
}

export async function annullaImport(id: string) {
  const utente = await richiediAdmin();
  const db = await creaClientServer();
  await db.from("import_magazzino").update({ stato: "annullato" }).eq("id", id).eq("stato", "anteprima");
  await registraOperazione(db, utente.id, { azione: "annulla_import", entita: "import_magazzino", entitaId: id });
  redirect("/admin/magazzino");
}
