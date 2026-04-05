/**
 * Client Supabase pour le navigateur (Client Components).
 * Utilise @supabase/ssr pour que les cookies de session restent synchronisés avec le middleware.
 */

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Configuration Supabase incomplète : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY doivent être définies dans l’environnement d’exécution."
    );
  }
  return createBrowserClient(url, anonKey);
}
