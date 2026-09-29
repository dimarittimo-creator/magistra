import "server-only";
import { NextResponse } from "next/server";
import { utenteCorrente, type Ruolo } from "@/lib/auth";

// Risposte per i file da scaricare (Excel, PDF) dalle route dell'area riservata.

export async function autorizza(...ruoli: Ruolo[]) {
  const utente = await utenteCorrente();
  if (!utente?.profilo || !ruoli.includes(utente.profilo.ruolo)) return null;
  return utente;
}

export function nonAutorizzato() {
  return NextResponse.json({ errore: "Non autorizzato" }, { status: 403 });
}

const TIPI = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

export function file(contenuto: Buffer | Uint8Array, nome: string, tipo: keyof typeof TIPI, inLinea = false) {
  return new NextResponse(new Uint8Array(contenuto), {
    headers: {
      "content-type": TIPI[tipo],
      "content-disposition": `${inLinea ? "inline" : "attachment"}; filename="${nome}"`,
      "cache-control": "no-store",
    },
  });
}
