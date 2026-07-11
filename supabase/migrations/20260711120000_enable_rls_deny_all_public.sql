-- Defense-in-depth : active la Row Level Security (RLS) sur TOUTES les tables du schéma `public`.
--
-- Aucune policy n'est créée, volontairement :
--   • Le rôle `service_role` (clé SUPABASE_SERVICE_ROLE_KEY, utilisée par TOUT l'accès aux
--     données côté serveur — cf. lib/supabaseServer.ts) possède l'attribut BYPASSRLS : il
--     continue donc de tout lire/écrire normalement. L'application n'est pas impactée.
--   • Les rôles `anon` / `authenticated` (clé publique NEXT_PUBLIC_SUPABASE_ANON_KEY, exposée
--     au navigateur) se voient refuser TOUT accès aux tables via l'API Data / PostgREST :
--     comportement « deny by default ».
--
-- Pré-requis vérifié avant écriture : 100 % des accès aux tables de l'app passent par
-- service_role. Les clients anon (navigateur + SSR) ne font que de l'authentification
-- (`supabase.auth.*`) et du Storage (`supabase.storage.*`). Les policies Storage vivent sur
-- `storage.objects` (schéma distinct) et ne sont PAS touchées ici.
--
-- Rollback : voir 20260711120000_enable_rls_deny_all_public_rollback.sql
--
-- NB : les tables créées APRÈS cette migration n'auront pas la RLS automatiquement.
-- Ré-exécuter ce script (idempotent) après tout ajout de table, ou ajouter le ALTER
-- directement dans la migration de création.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
