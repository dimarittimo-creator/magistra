import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";

export type Ruolo = "farmacia" | "privato" | "admin" | "operatore" | "deposito";

export type Profilo = {
  id: string;
  ruolo: Ruolo;
  nome: string | null;
  email: string | null;
  farmacia_id: string | null;
  privato_id: string | null;
};

export type Utente = { id: string; email: string; profilo: Profilo | null };

/** Utente collegato (una sola lettura per richiesta), o null. */
export const utenteCorrente = cache(async (): Promise<Utente | null> => {
  const db = await creaClientServer();
  const { data } = await db.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const { data: profilo } = await db
    .from("profili_utente")
    .select("id, ruolo, nome, email, farmacia_id, privato_id")
    .eq("id", claims.sub)
    .maybeSingle();
  return { id: claims.sub, email: String(claims.email ?? ""), profilo: (profilo as Profilo | null) ?? null };
});

/** Pagina iniziale dell'area riservata per ruolo. */
export function paginaIniziale(ruolo: Ruolo | undefined): string {
  switch (ruolo) {
    case "admin":
    case "operatore":
      return "/admin";
    case "farmacia":
      return "/farmacia";
    case "privato":
      return "/negozio";
    default:
      return "/";
  }
}

/**
 * Richiede un utente collegato con uno dei ruoli indicati.
 * Da chiamare all'inizio di ogni pagina e di ogni azione riservata.
 */
export async function richiediRuolo(...ruoli: Ruolo[]): Promise<Utente & { profilo: Profilo }> {
  const utente = await utenteCorrente();
  if (!utente) redirect("/accesso");
  if (!utente.profilo || !ruoli.includes(utente.profilo.ruolo)) redirect(paginaIniziale(utente.profilo?.ruolo));
  return utente as Utente & { profilo: Profilo };
}

/**
 * Farmacia con iscrizione approvata: serve per catalogo, carrello e prenotazioni.
 * Le farmacie in attesa o bloccate tornano alla pagina iniziale, che spiega il motivo.
 */
export async function richiediFarmaciaAttiva(): Promise<Utente & { profilo: Profilo; farmaciaId: string }> {
  const utente = await richiediRuolo("farmacia");
  const db = await creaClientServer();
  const { data } = await db.rpc("farmacia_attiva");
  if (!data || !utente.profilo.farmacia_id) redirect("/farmacia");
  return { ...utente, farmaciaId: utente.profilo.farmacia_id };
}

/** Cliente privato con account attivo (non bloccato). */
export async function richiediPrivato(): Promise<Utente & { profilo: Profilo; privatoId: string }> {
  const utente = await utenteCorrente();
  if (!utente) redirect("/accesso?area=privati");
  if (utente.profilo?.ruolo !== "privato" || !utente.profilo.privato_id) redirect(paginaIniziale(utente.profilo?.ruolo));
  const db = await creaClientServer();
  const { data } = await db.rpc("privato_attivo");
  if (!data) redirect("/negozio?bloccato=1");
  return { ...utente, profilo: utente.profilo, privatoId: utente.profilo.privato_id };
}

export const richiediAdmin = () => richiediRuolo("admin");
export const richiediStaff = () => richiediRuolo("admin", "operatore");
export const richiediFarmacia = () => richiediRuolo("farmacia");

/** Accetta solo percorsi interni ("/farmacia"), mai indirizzi esterni. */
export function percorsoSicuro(valore: unknown, predefinito = "/area"): string {
  return typeof valore === "string" && valore.startsWith("/") && !valore.startsWith("//") && !valore.includes("\\")
    ? valore
    : predefinito;
}
