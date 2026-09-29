"use server";

import { redirect } from "next/navigation";
import { creaClientServer } from "@/lib/supabase/server";

export async function esci() {
  const db = await creaClientServer();
  await db.auth.signOut();
  redirect("/");
}
