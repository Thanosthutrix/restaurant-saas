-- Portail B2C : colonnes publiques sur restaurants / plats + table avis certifiés.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS cuisine_type text,
  ADD COLUMN IF NOT EXISTS hygiene_score text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS opening_hours text,
  ADD COLUMN IF NOT EXISTS is_public_listed boolean NOT NULL DEFAULT false;

ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS chk_restaurants_hygiene_score;
ALTER TABLE public.restaurants ADD CONSTRAINT chk_restaurants_hygiene_score CHECK (
  hygiene_score IS NULL
  OR hygiene_score IN ('Très satisfaisant', 'Satisfaisant', 'À améliorer', 'Non communiqué')
);

COMMENT ON COLUMN public.restaurants.is_public_listed IS
  'Restaurant visible sur le portail B2C (annuaire public).';

ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS menu_category text;

ALTER TABLE public.dishes DROP CONSTRAINT IF EXISTS chk_dishes_menu_category;
ALTER TABLE public.dishes ADD CONSTRAINT chk_dishes_menu_category CHECK (
  menu_category IS NULL OR menu_category IN ('entrée', 'plat', 'dessert')
);

COMMENT ON COLUMN public.dishes.is_public IS
  'Plat affiché sur la carte publique B2C (géré depuis l''ERP).';

CREATE TABLE IF NOT EXISTS public.restaurant_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  rating numeric(2, 1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL,
  author_name text,
  is_certified boolean NOT NULL DEFAULT false,
  ticket_sale_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_restaurant_reviews_comment_non_empty CHECK (length(trim(comment)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_restaurant
  ON public.restaurant_reviews (restaurant_id, created_at DESC);

COMMENT ON TABLE public.restaurant_reviews IS
  'Avis clients B2C ; is_certified = validé via ticket de caisse ERP.';
