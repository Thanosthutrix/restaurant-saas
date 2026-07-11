-- ROLLBACK de 20260711120000_enable_rls_deny_all_public.sql
-- Désactive la RLS sur toutes les tables du schéma `public` (revient à l'état antérieur).
-- À n'appliquer que si la RLS deny-all pose un problème inattendu.

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
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END $$;
