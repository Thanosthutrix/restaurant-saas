-- Plan cuisine : positions des équipements froid (relevés température ouverture/fermeture).

CREATE TABLE IF NOT EXISTS public.restaurant_kitchen_floor_plans (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  layout jsonb NOT NULL DEFAULT '{"version":2,"activeLevelId":"kitchen-main","levels":[{"id":"kitchen-main","label":"Cuisine principale","sortOrder":0,"layout":{"baseTables":{},"fixtures":[],"removedFromPlan":[]}}]}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.restaurant_kitchen_floor_plans IS
  'Plan cuisine de référence (positions équipements froid + fixtures). Format JSON v2 multi-niveaux, identique au plan de salle.';

COMMENT ON COLUMN public.restaurant_kitchen_floor_plans.layout IS
  'JSON v2 : { version: 2, activeLevelId, levels: [{ id, label, sortOrder, layout: { baseTables, fixtures, removedFromPlan } }] }. Les clés baseTables sont des hygiene_elements.id.';
