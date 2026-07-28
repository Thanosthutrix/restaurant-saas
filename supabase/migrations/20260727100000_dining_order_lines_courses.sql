-- Services de repas (entrée / plat / dessert) : envoi cuisine différé + suivi par service.

ALTER TABLE public.dining_order_lines
  ADD COLUMN IF NOT EXISTS course_type text
    CHECK (course_type IS NULL OR course_type IN ('entrée', 'plat', 'dessert')),
  ADD COLUMN IF NOT EXISTS sent_to_kitchen_at timestamptz NULL;

COMMENT ON COLUMN public.dining_order_lines.course_type IS
  'Service du repas (snapshot dishes.menu_category). NULL = boisson / hors service.';
COMMENT ON COLUMN public.dining_order_lines.sent_to_kitchen_at IS
  'NULL = en attente d''envoi cuisine ; renseigné = service lancé par le serveur.';

-- Lignes existantes : considérées déjà envoyées (comportement inchangé).
UPDATE public.dining_order_lines
SET sent_to_kitchen_at = created_at
WHERE sent_to_kitchen_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dining_order_lines_kitchen_fired
  ON public.dining_order_lines (restaurant_id, dining_order_id)
  WHERE sent_to_kitchen_at IS NOT NULL AND is_prepared = false;
