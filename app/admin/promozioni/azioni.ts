"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { richiediAdmin } from "@/lib/auth";
import { leggi, valoriModulo, type StatoModulo } from "@/lib/farmacie/dati";
import { registraOperazione } from "@/lib/registro";
import { creaClientAdmin } from "@/lib/supabase/admin";
import { creaClientServer } from "@/lib/supabase/server";

const TIPI = ["sconto_percentuale", "sconto_merce", "omaggio"];
const AMBITI = ["catalogo", "linea", "prodotto", "lotto"];
const TIPI_IMMAGINE: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function salvaPromozione(id: string | null, _prima: StatoModulo, fd: FormData): Promise<StatoModulo> {
  const utente = await richiediAdmin();
  const valori = valoriModulo(fd);
  const errori: Record<string, string> = {};
  const tipo = leggi(fd, "tipo");
  const ambito = leggi(fd, "ambito");
  const numero = (nome: string) => {
    const t = leggi(fd, nome).replace(",", ".");
    return t ? Number(t) : null;
  };
  const dati = {
    nome: leggi(fd, "nome"),
    descrizione: leggi(fd, "descrizione") || null,
    tipo,
    sconto_percentuale: tipo === "sconto_percentuale" ? numero("sconto_percentuale") : null,
    compra: tipo !== "sconto_percentuale" ? numero("compra") : null,
    omaggio_quantita: tipo !== "sconto_percentuale" ? numero("omaggio_quantita") : null,
    omaggio_prodotto_codice: tipo === "omaggio" ? leggi(fd, "omaggio_prodotto_codice") || null : null,
    ambito,
    prodotto_codice: ambito === "prodotto" ? leggi(fd, "prodotto_codice") || null : null,
    linea_id: ambito === "linea" ? leggi(fd, "linea_id") || null : null,
    lotto_id: ambito === "lotto" ? leggi(fd, "lotto_id") || null : null,
    gruppo_id: leggi(fd, "gruppo_id") || null,
    inizio: leggi(fd, "inizio"),
    fine: leggi(fd, "fine"),
    sospesa: Boolean(fd.get("sospesa")),
    omaggio_extra_testo: leggi(fd, "omaggio_extra_testo") || null,
    omaggio_extra_ogni: leggi(fd, "omaggio_extra_testo") ? numero("omaggio_extra_ogni") : null,
    omaggio_extra_quantita: leggi(fd, "omaggio_extra_testo") ? numero("omaggio_extra_quantita") : null,
  };
  if (dati.omaggio_extra_testo) {
    if (dati.omaggio_extra_testo.length > 120) errori.omaggio_extra_testo = "Massimo 120 caratteri";
    if (!Number.isInteger(dati.omaggio_extra_ogni) || dati.omaggio_extra_ogni! < 1) errori.omaggio_extra_ogni = "Numero intero di pezzi";
    if (!Number.isInteger(dati.omaggio_extra_quantita) || dati.omaggio_extra_quantita! < 1) errori.omaggio_extra_quantita = "Numero intero";
  }
  const file = fd.get("immagine");
  const immagine = file instanceof File && file.size > 0 ? file : null;
  if (immagine && !TIPI_IMMAGINE[immagine.type]) errori.immagine = "Carica un'immagine JPG, PNG o WebP";
  else if (immagine && immagine.size > 5 * 1024 * 1024) errori.immagine = "Immagine troppo grande (massimo 5 MB)";
  if (!dati.nome) errori.nome = "Dai un nome alla promozione";
  if (!TIPI.includes(tipo)) errori.tipo = "Scegli il tipo";
  if (!AMBITI.includes(ambito)) errori.ambito = "Scegli a cosa si applica";
  if (tipo === "sconto_percentuale" && !(dati.sconto_percentuale! > 0 && dati.sconto_percentuale! <= 100)) errori.sconto_percentuale = "Sconto tra 0 e 100%";
  if (tipo !== "sconto_percentuale") {
    if (!Number.isInteger(dati.compra) || dati.compra! < 1) errori.compra = "Numero intero di pezzi";
    if (!Number.isInteger(dati.omaggio_quantita) || dati.omaggio_quantita! < 1) errori.omaggio_quantita = "Numero intero di pezzi";
  }
  if (tipo === "omaggio" && !dati.omaggio_prodotto_codice) errori.omaggio_prodotto_codice = "Scegli il prodotto in omaggio";
  if (ambito === "prodotto" && !dati.prodotto_codice) errori.prodotto_codice = "Scegli il prodotto";
  if (ambito === "linea" && !dati.linea_id) errori.linea_id = "Scegli la linea";
  if (ambito === "lotto" && !dati.lotto_id) errori.lotto_id = "Scegli il lotto";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dati.inizio)) errori.inizio = "Data di inizio";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dati.fine)) errori.fine = "Data di fine";
  else if (dati.fine < dati.inizio) errori.fine = "La fine deve essere dopo l'inizio";
  if (Object.keys(errori).length) return { errori, valori, messaggio: "Controlla i campi evidenziati." };

  const db = await creaClientServer();
  const { data: prima } = id ? await db.from("promozioni").select("*").eq("id", id).single() : { data: null };
  const { data, error } = id
    ? await db.from("promozioni").update(dati).eq("id", id).select("id").single()
    : await db.from("promozioni").insert({ ...dati, creato_da: utente.id }).select("id").single();
  if (error) return { valori, messaggio: "Salvataggio non riuscito. Riprova." };

  // Volantino: nuovo file caricato oppure rimozione richiesta
  let immagine_path: string | null | undefined;
  if (immagine) {
    immagine_path = `${data.id}/${Date.now()}.${TIPI_IMMAGINE[immagine.type]}`;
    const archivio = creaClientAdmin().storage.from("promozioni");
    const { error: errFile } = await archivio.upload(immagine_path, new Uint8Array(await immagine.arrayBuffer()), { contentType: immagine.type });
    if (errFile) return { valori, messaggio: "Promozione salvata, ma il caricamento dell'immagine non è riuscito. Riprova." };
    if (prima?.immagine_path) await archivio.remove([prima.immagine_path]);
  } else if (fd.get("rimuovi_immagine") && prima?.immagine_path) {
    immagine_path = null;
    await creaClientAdmin().storage.from("promozioni").remove([prima.immagine_path]);
  }
  if (immagine_path !== undefined) await db.from("promozioni").update({ immagine_path }).eq("id", data.id);

  await registraOperazione(db, utente.id, {
    azione: id ? "modifica_promozione" : "crea_promozione",
    entita: "promozioni",
    entitaId: data.id,
    prima,
    dopo: immagine_path !== undefined ? { ...dati, immagine_path } : dati,
  });
  revalidatePath("/", "layout");
  if (!id) redirect(`/admin/promozioni/${data.id}?salvata=1`);
  return { ok: true, valori, messaggio: "Promozione salvata." };
}

/** Duplica una promozione: la copia nasce sospesa, da sistemare nelle date e riattivare. */
export async function duplicaPromozione(id: string) {
  const utente = await richiediAdmin();
  const db = await creaClientServer();
  const { data: p } = await db.from("promozioni").select("*").eq("id", id).single();
  if (!p) return;
  const { id: _id, creato_il: _c, aggiornato_il: _a, ...resto } = p;
  const { data: copia } = await db
    .from("promozioni")
    .insert({ ...resto, immagine_path: null, nome: `Copia di ${p.nome}`, sospesa: true, duplicata_da: id, creato_da: utente.id })
    .select("id")
    .single();
  await registraOperazione(db, utente.id, { azione: "duplica_promozione", entita: "promozioni", entitaId: copia?.id, dopo: { da: id } });
  redirect(`/admin/promozioni/${copia!.id}?copia=1`);
}
