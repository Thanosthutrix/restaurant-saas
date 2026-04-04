-- Migration: colonnes normalisées pour matching + index
-- À exécuter dans Supabase SQL Editor

-- dishes.name_normalized
ALTER TABLE dishes
  ADD COLUMN IF NOT EXISTS name_normalized text;

CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_name_normalized
  ON dishes (restaurant_id, name_normalized);

-- dish_aliases.alias_normalized + contrainte unique
ALTER TABLE dish_aliases
  ADD COLUMN IF NOT EXISTS alias_normalized text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dish_aliases_restaurant_alias_normalized_unique
  ON dish_aliases (restaurant_id, alias_normalized)
  WHERE alias_normalized IS NOT NULL AND alias_normalized != '';

CREATE INDEX IF NOT EXISTS idx_dish_aliases_restaurant_alias_normalized
  ON dish_aliases (restaurant_id, alias_normalized);

-- Backfill (à exécuter après déploiement de la logique normalizeDishLabel côté app,
-- ou via une fonction SQL de normalisation simple pour le backfill)
-- Exemple backfill minimal (lowercase + trim) pour remplir une première fois :
UPDATE dishes
SET name_normalized = lower(trim(name))
WHERE name_normalized IS NULL OR name_normalized = '';

UPDATE dish_aliases
SET alias_normalized = lower(trim(alias))
WHERE alias_normalized IS NULL OR alias_normalized = '';
