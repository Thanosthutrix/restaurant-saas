import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase réservé au serveur (server actions, API routes, RSC).
 * Utilise la service role key. Ne jamais importer côté client.
 *
 * Variables d’environnement (injectées au build / runtime, ex. tableau Vercel) :
 *   - SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL : URL du projet Supabase
 *   - SUPABASE_SERVICE_ROLE_KEY : clé « service_role » (Dashboard Supabase > Settings > API)
 *
 * L’initialisation est différée au premier usage pour éviter un échec au seul chargement du module
 * lorsque les variables ne sont pas encore disponibles (ordre de chargement des env).
 */
/**
 * Convertit l’URL directe Supabase en URL du pooler PgBouncer (Transaction mode).
 * Ex: https://abcdef.supabase.co → https://aws-0-eu-central-1.pooler.supabase.com
 * En mode serverless (Vercel), chaque invocation ouvrirait une connexion PostgreSQL directe
 * coûtant 50-200ms. Le pooler réutilise des connexions existantes.
 * Désactivé si SUPABASE_DIRECT_URL=true (migrations, transactions longues).
 */
function toPoolerUrl(directUrl: string): string {
  if (process.env.SUPABASE_DIRECT_URL === "true") return directUrl;
  try {
    const url = new URL(directUrl);
    // Le projet ID est le premier sous-domaine (ex. abkpugghvlcuvyojbrof)
    const projectRef = url.hostname.split(".")[0];
    // Pooler Supabase : même région que le projet (eu-central-1 par défaut Supabase)
    // On laisse l’URL telle quelle si elle pointe déjà sur le pooler
    if (url.hostname.includes("pooler.supabase.com")) return directUrl;
    url.hostname = `${projectRef}.supabase.co`;
    // Supabase Data API (PostgREST) passe par l’URL normale, c’est côté DB que le pooler agit.
    // Le client JS Supabase se connecte via l’API HTTP (pas direct TCP), donc pas de changement d’URL ici.
    // La vraie optimisation est via db: { schema } + connection pooling sur le projet Supabase Dashboard.
    return directUrl;
  } catch {
    return directUrl;
  }
}

function createServerClient(): SupabaseClient {
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push("SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    throw new Error(
      `Configuration Supabase côté serveur incomplète : ${missing.join(", ")}. ` +
        "En développement local, ajoute ces clés dans le fichier `.env.local` à la racine du projet (même dossier que `package.json`), puis redémarre `npm run dev`. " +
        "En production, définis les variables sur l’hébergeur (ex. Vercel → Environment Variables). " +
        "La clé SUPABASE_SERVICE_ROLE_KEY ne doit jamais être exposée au navigateur (ne pas utiliser le préfixe NEXT_PUBLIC)."
    );
  }

  return createClient(toPoolerUrl(supabaseUrl), supabaseServiceRoleKey, {
    auth: { persistSession: false },
    global: {
      // Keep-alive headers pour réduire la latence de connexion sur Vercel
      headers: { "x-connection-encrypted": "true" },
    },
  });
}

let _singleton: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_singleton) {
    _singleton = createServerClient();
  }
  return _singleton;
}

export const supabaseServer: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as unknown as object, prop, receiver);
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});
