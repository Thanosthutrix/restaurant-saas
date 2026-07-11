-- Formules menu B2C (entrée+plat+dessert, entrée+plat, plat+dessert)

CREATE TABLE IF NOT EXISTS public.restaurant_public_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_ttc numeric(10, 2) NOT NULL CHECK (price_ttc > 0),
  formula_type text NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_restaurant_public_menus_name_non_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT chk_restaurant_public_menus_formula_type CHECK (
    formula_type IN ('entree_plat_dessert', 'entree_plat', 'plat_dessert')
  )
);

CREATE INDEX IF NOT EXISTS idx_restaurant_public_menus_restaurant
  ON public.restaurant_public_menus (restaurant_id, sort_order, name);

COMMENT ON TABLE public.restaurant_public_menus IS
  'Formules menu affichées sur la carte publique B2C (gérées depuis l''ERP).';
