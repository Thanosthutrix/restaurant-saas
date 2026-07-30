-- Personnalisation commande : retrait garniture / changement accompagnement (pass cuisine).

ALTER TABLE public.dish_components
  ADD COLUMN IF NOT EXISTS component_role text NOT NULL DEFAULT 'integrated';

ALTER TABLE public.dish_components
  DROP CONSTRAINT IF EXISTS chk_dish_components_role;

ALTER TABLE public.dish_components
  ADD CONSTRAINT chk_dish_components_role CHECK (
    component_role IN ('integrated', 'topping', 'accompaniment')
  );

COMMENT ON COLUMN public.dish_components.component_role IS
  'integrated = dans la recette ou prep (non retirable au service) ; topping = sans X ; accompaniment = substituable.';

ALTER TABLE public.dining_order_lines
  ADD COLUMN IF NOT EXISTS modification_fingerprint text NULL;

COMMENT ON COLUMN public.dining_order_lines.modification_fingerprint IS
  'Empreinte des modifs (JSON trié) pour distinguer deux lignes même plat avec personnalisations différentes.';

CREATE TABLE IF NOT EXISTS public.dining_order_line_modifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  dining_order_line_id uuid NOT NULL REFERENCES public.dining_order_lines(id) ON DELETE CASCADE,
  modification_type text NOT NULL CHECK (
    modification_type IN ('remove_component', 'swap_accompaniment')
  ),
  dish_component_id uuid REFERENCES public.dish_components(id) ON DELETE SET NULL,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  replacement_inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dining_line_mods_line
  ON public.dining_order_line_modifications (dining_order_line_id);

CREATE INDEX IF NOT EXISTS idx_dining_order_lines_fingerprint
  ON public.dining_order_lines (dining_order_id, dish_id, modification_fingerprint);
