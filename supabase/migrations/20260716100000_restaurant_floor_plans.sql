-- Plan de salle : positions des tables, fixtures (murs, bar…) et exclusions volontaires.
-- Persisté côté serveur (avant : localStorage uniquement).

CREATE TABLE IF NOT EXISTS public.restaurant_floor_plans (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  layout jsonb NOT NULL DEFAULT '{"baseTables":{},"fixtures":[],"removedFromPlan":[]}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.restaurant_floor_plans IS
  'Plan de salle de référence (positions tables + fixtures). Les overrides temporaires de service restent en sessionStorage.';

COMMENT ON COLUMN public.restaurant_floor_plans.layout IS
  'JSON v2 : { version: 2, activeLevelId, levels: [{ id, label, sortOrder, layout: { baseTables, fixtures, removedFromPlan } }] }. Legacy v1 (layout seul) migré automatiquement.';
