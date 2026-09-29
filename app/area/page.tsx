import { redirect } from "next/navigation";
import { paginaIniziale, utenteCorrente } from "@/lib/auth";

// Punto di arrivo dopo accesso e conferma email: porta ognuno alla propria area.
export default async function Area() {
  const utente = await utenteCorrente();
  redirect(utente ? paginaIniziale(utente.profilo?.ruolo) : "/accesso");
}
