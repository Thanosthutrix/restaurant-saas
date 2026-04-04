-- Alignement schéma avec le code (purchase_orders, purchase_order_lines, delivery_notes).
-- Référence unique : lib/db.ts (types + select/insert/update).
-- Crée les tables si elles n'existent pas, sinon ajoute les colonnes manquantes et corrige les contraintes.

-- ---------------------------------------------------------------------------
-- 0. Création des tables si absentes (schéma complet attendu par le code)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'generated',
  generated_message text,
  expected_delivery_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_purchase_orders_status CHECK (status IN ('generated', 'expected_delivery', 'partially_received', 'received', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  ordered_qty_purchase_unit numeric NOT NULL,
  purchase_unit text NOT NULL,
  purchase_to_stock_ratio numeric NOT NULL,
  supplier_sku_snapshot text,
  item_name_snapshot text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_pol_qty_positive CHECK (ordered_qty_purchase_unit > 0),
  CONSTRAINT chk_pol_ratio_positive CHECK (purchase_to_stock_ratio > 0)
);

CREATE TABLE IF NOT EXISTS delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_order_id uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_delivery_notes_status CHECK (status IN ('draft', 'received'))
);

-- ---------------------------------------------------------------------------
-- 1. purchase_orders (déjà existant) : renommages et colonnes manquantes
-- ---------------------------------------------------------------------------

-- Colonnes possibles à renommer (anciennes conventions)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'message')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'generated_message') THEN
    ALTER TABLE purchase_orders RENAME COLUMN message TO generated_message;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'delivery_date')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_orders' AND column_name = 'expected_delivery_date') THEN
    ALTER TABLE purchase_orders RENAME COLUMN delivery_date TO expected_delivery_date;
  END IF;
END $$;

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS generated_message text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_delivery_date date;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS chk_purchase_orders_status;
ALTER TABLE purchase_orders ADD CONSTRAINT chk_purchase_orders_status
  CHECK (status IN ('generated', 'expected_delivery', 'partially_received', 'received', 'cancelled'));

-- ---------------------------------------------------------------------------
-- 2. purchase_order_lines : colonnes et éventuel renommage item_id -> inventory_item_id
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_order_lines' AND column_name = 'item_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchase_order_lines' AND column_name = 'inventory_item_id') THEN
    ALTER TABLE purchase_order_lines RENAME COLUMN item_id TO inventory_item_id;
  END IF;
END $$;

ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS inventory_item_id uuid REFERENCES inventory_items(id) ON DELETE RESTRICT;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS ordered_qty_purchase_unit numeric;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS purchase_unit text;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS purchase_to_stock_ratio numeric;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS supplier_sku_snapshot text;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS item_name_snapshot text;
ALTER TABLE purchase_order_lines ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Contraintes sur les colonnes existantes (si la table avait été créée partiellement)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pol_qty_positive') THEN
    ALTER TABLE purchase_order_lines ADD CONSTRAINT chk_pol_qty_positive CHECK (ordered_qty_purchase_unit > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_pol_ratio_positive') THEN
    ALTER TABLE purchase_order_lines ADD CONSTRAINT chk_pol_ratio_positive CHECK (purchase_to_stock_ratio > 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. delivery_notes : contrainte status uniquement (colonnes déjà conformes en général)
-- ---------------------------------------------------------------------------

ALTER TABLE delivery_notes DROP CONSTRAINT IF EXISTS chk_delivery_notes_status;
ALTER TABLE delivery_notes ADD CONSTRAINT chk_delivery_notes_status
  CHECK (status IN ('draft', 'received'));

-- ---------------------------------------------------------------------------
-- 4. Index manquants (idempotents)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_purchase_orders_restaurant ON purchase_orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created ON purchase_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_po ON purchase_order_lines(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_restaurant ON delivery_notes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_supplier ON delivery_notes(supplier_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_po ON delivery_notes(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_created ON delivery_notes(created_at DESC);
