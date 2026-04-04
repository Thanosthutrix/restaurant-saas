-- Migration: statut de recette sur les plats (missing / draft / validated)
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS recipe_status text;

UPDATE dishes SET recipe_status = 'draft' WHERE recipe_status IS NULL AND EXISTS (
  SELECT 1 FROM dish_components dc WHERE dc.dish_id = dishes.id
);
UPDATE dishes SET recipe_status = 'missing' WHERE recipe_status IS NULL;

ALTER TABLE dishes ALTER COLUMN recipe_status SET DEFAULT 'missing';
ALTER TABLE dishes ALTER COLUMN recipe_status SET NOT NULL;

ALTER TABLE dishes DROP CONSTRAINT IF EXISTS chk_dishes_recipe_status;
ALTER TABLE dishes ADD CONSTRAINT chk_dishes_recipe_status
  CHECK (recipe_status IN ('missing', 'draft', 'validated'));

COMMENT ON COLUMN dishes.recipe_status IS 'missing = aucun composant ; draft = recette brouillon ; validated = recette validée par le restaurateur';
