-- Inventaire matériel cuisine / salle, alimenté par onboarding IA ou saisie.
CREATE TABLE IF NOT EXISTS restaurant_equipment_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  area_kind text NOT NULL DEFAULT 'other',
  area_label text NOT NULL DEFAULT '',
  hygiene_category text,
  quantity integer NOT NULL DEFAULT 1,
  create_hygiene_element boolean NOT NULL DEFAULT false,
  create_dining_table boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_restaurant_equipment_area_kind CHECK (
    area_kind IN ('kitchen', 'dining', 'bar', 'storage', 'sanitary', 'other')
  ),
  CONSTRAINT chk_restaurant_equipment_quantity CHECK (quantity > 0),
  CONSTRAINT chk_restaurant_equipment_name CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_equipment_inventory_restaurant
  ON restaurant_equipment_inventory(restaurant_id, area_kind, area_label);

COMMENT ON TABLE restaurant_equipment_inventory IS
  'Inventaire matériel cuisine/salle. Peut générer des éléments PND hygiène et des tables de salle.';
