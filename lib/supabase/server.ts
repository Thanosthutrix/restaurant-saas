/**
 * Client Supabase côté serveur avec cookies (session utilisateur).
 * Utiliser pour récupérer l'utilisateur connecté dans les Server Components et Server Actions.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Variables Supabase (URL / ANON_KEY) manquantes.");

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // En Server Component set peut échouer (read-only) ; le middleware gère le refresh.
        }
      },
    },
  });
}
