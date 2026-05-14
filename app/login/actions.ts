"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Déconnecte l'utilisateur et redirige vers l'URL indiquée (ex. page de signup avec token). */
export async function signOutAndRedirect(next: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(next);
}
