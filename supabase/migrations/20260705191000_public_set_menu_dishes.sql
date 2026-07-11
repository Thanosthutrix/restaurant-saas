-- Plats associés aux formules menu (par étape : entrée, plat, dessert)

CREATE TABLE IF NOT EXISTS public.restaurant_public_menu_dishes (
  menu_id uuid NOT NULL REFERENCES public.restaurant_public_menus(id) ON DELETE CASCADE,
  dish_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  step_category text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (menu_id, dish_id),
  CONSTRAINT chk_public_menu_dish_step CHECK (
    step_category IN ('entrée', 'plat', 'dessert')
  )
);

CREATE INDEX IF NOT EXISTS idx_public_menu_dishes_menu
  ON public.restaurant_public_menu_dishes (menu_id, step_category, sort_order);

COMMENT ON TABLE public.restaurant_public_menu_dishes IS
  'Plats proposés dans une formule menu, regroupés par étape (entrée / plat / dessert).';
