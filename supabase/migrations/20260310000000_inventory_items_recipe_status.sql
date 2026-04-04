-- Migration: statut de recette sur les préparations (inventory_items)
-- missing / draft / validated (cohérent avec dishes.recipe_status)
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS recipe_status text;

UPDATE inventory_items
SET recipe_status = 'draft'
WHERE recipe_status IS NULL
  AND item_type = 'prep'
  AND EXISTS (
    SELECT 1 FROM inventory_item_components iic WHERE iic.parent_item_id = inventory_items.id
  );
UPDATE inventory_items SET recipe_status = 'missing' WHERE recipe_status IS NULL;

ALTER TABLE inventory_items ALTER COLUMN recipe_status SET DEFAULT 'missing';
ALTER TABLE inventory_items ALTER COLUMN recipe_status SET NOT NULL;

ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS chk_inventory_items_recipe_status;
ALTER TABLE inventory_items ADD CONSTRAINT chk_inventory_items_recipe_status
  CHECK (recipe_status IN ('missing', 'draft', 'validated'));

COMMENT ON COLUMN inventory_items.recipe_status IS 'Pour les preps : missing = aucun composant ; draft = brouillon ; validated = validée. Pour ingredient/resale : valeur par défaut missing.';
