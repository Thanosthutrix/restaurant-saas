-- Rubriques personnalisées par restaurant (hiérarchie) pour plats et composants stock.

CREATE TABLE IF NOT EXISTS public.restaurant_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.restaurant_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  applies_to text NOT NULL DEFAULT 'both' CHECK (applies_to IN ('dish', 'inventory', 'both')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_restaurant_categories_name_non_empty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_categories_restaurant
  ON public.restaurant_categories (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_categories_parent
  ON public.restaurant_categories (restaurant_id, parent_id);

COMMENT ON TABLE public.restaurant_categories IS 'Arborescence de rubriques (ex. Vin > Région > Couleur) ; applies_to indique si la rubrique sert au carte, au stock, ou aux deux.';
COMMENT ON COLUMN public.restaurant_categories.applies_to IS 'dish = plats uniquement ; inventory = composants stock ; both = les deux.';

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.restaurant_categories(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.restaurant_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_category ON public.dishes (restaurant_id, category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant_category ON public.inventory_items (restaurant_id, category_id);
