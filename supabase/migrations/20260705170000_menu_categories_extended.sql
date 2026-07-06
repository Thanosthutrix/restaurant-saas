-- Étend les catégories carte publique : vins, boissons, à partager
ALTER TABLE public.dishes DROP CONSTRAINT IF EXISTS chk_dishes_menu_category;
ALTER TABLE public.dishes ADD CONSTRAINT chk_dishes_menu_category CHECK (
  menu_category IS NULL OR menu_category IN (
    'entrée',
    'plat',
    'dessert',
    'à_partager',
    'vin',
    'boisson'
  )
);
