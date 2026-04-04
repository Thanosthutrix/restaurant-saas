import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase réservé au serveur (server actions, API routes, RSC).
 * Utilise la service role key. Ne jamais importer côté client.
 *
 * Variables attendues dans .env.local :
 *   - NEXT_PUBLIC_SUPABASE_URL  (ou SUPABASE_URL) : URL du projet Supabase
 *   - SUPABASE_SERVICE_ROLE_KEY : clé "service_role" (Dashboard Supabase > Settings > API)
 */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  const missing: string[] = [];
  if (!supabaseUrl) missing.push("URL (NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_URL)");
  if (!supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  throw new Error(
    `Supabase serveur : variables manquantes dans .env.local : ${missing.join(", ")}. ` +
      "SUPABASE_SERVICE_ROLE_KEY se trouve dans Dashboard Supabase > Settings > API (ne pas l'exposer côté client)."
  );
}

export const supabaseServer = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
