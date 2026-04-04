-- Migration: modèle recettes + stock (composants, préparations, plats)
-- Tables: inventory_items, inventory_item_components, dish_components
-- Évolution: dishes.production_mode

-- 1) inventory_items (composants stockables / composables)
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  name text NOT NULL,
  unit text NOT NULL,
  item_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_inventory_items_item_type CHECK (item_type IN ('ingredient', 'prep', 'resale')),
  CONSTRAINT chk_inventory_items_unit_non_empty CHECK (length(trim(unit)) > 0),
  CONSTRAINT chk_inventory_items_name_non_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant ON inventory_items(restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_restaurant_name_lower
  ON inventory_items(restaurant_id, lower(trim(name)));

COMMENT ON TABLE inventory_items IS 'Composants stockables: matières premières (ingredient), préparations (prep), revente (resale).';

-- 2) inventory_item_components (composition des préparations)
CREATE TABLE IF NOT EXISTS inventory_item_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  parent_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  component_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  qty numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_iic_qty_positive CHECK (qty > 0),
  CONSTRAINT chk_iic_no_self CHECK (parent_item_id != component_item_id),
  CONSTRAINT uq_iic_parent_component UNIQUE (parent_item_id, component_item_id)
);

CREATE INDEX IF NOT EXISTS idx_iic_parent ON inventory_item_components(parent_item_id);
CREATE INDEX IF NOT EXISTS idx_iic_component ON inventory_item_components(component_item_id);

COMMENT ON TABLE inventory_item_components IS 'Composition des préparations intermédiaires (prep): parent = prep, components = ingredients ou autres.';

-- 3) dishes.production_mode (NOT NULL, défaut 'prepared')
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS production_mode text;

UPDATE dishes SET production_mode = 'prepared' WHERE production_mode IS NULL;

ALTER TABLE dishes ALTER COLUMN production_mode SET DEFAULT 'prepared';
ALTER TABLE dishes ALTER COLUMN production_mode SET NOT NULL;

ALTER TABLE dishes DROP CONSTRAINT IF EXISTS chk_dishes_production_mode;
ALTER TABLE dishes ADD CONSTRAINT chk_dishes_production_mode
  CHECK (production_mode IN ('prepared', 'resale'));

-- 4) dish_components (composition des plats vendus)
CREATE TABLE IF NOT EXISTS dish_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  dish_id uuid NOT NULL REFERENCES dishes(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  qty numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_dc_qty_positive CHECK (qty > 0),
  CONSTRAINT uq_dc_dish_item UNIQUE (dish_id, inventory_item_id)
);

CREATE INDEX IF NOT EXISTS idx_dish_components_dish ON dish_components(dish_id);
CREATE INDEX IF NOT EXISTS idx_dish_components_item ON dish_components(inventory_item_id);

COMMENT ON TABLE dish_components IS 'Composition des plats vendus: chaque plat consomme des inventory_items (ingredient, prep ou resale).';

-- Note: Les tables ingredients et recipe_items, si elles existent en base, ne sont pas migrées.
-- La nouvelle référence est inventory_items + inventory_item_components + dish_components.
