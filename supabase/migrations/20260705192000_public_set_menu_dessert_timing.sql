-- Choix du dessert : en même temps que le reste ou en fin de repas (2e temps)

ALTER TABLE public.restaurant_public_menus
  ADD COLUMN IF NOT EXISTS dessert_timing text NOT NULL DEFAULT 'with_previous';

ALTER TABLE public.restaurant_public_menus
  DROP CONSTRAINT IF EXISTS chk_restaurant_public_menus_dessert_timing;

ALTER TABLE public.restaurant_public_menus
  ADD CONSTRAINT chk_restaurant_public_menus_dessert_timing CHECK (
    dessert_timing IN ('with_previous', 'second_step')
  );

COMMENT ON COLUMN public.restaurant_public_menus.dessert_timing IS
  'with_previous = dessert choisi avec entrée/plat ; second_step = dessert choisi en fin de repas.';
