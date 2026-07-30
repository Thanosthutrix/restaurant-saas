-- Seuils d'attente plan de salle (minutes depuis l'envoi serveur).
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS dining_wait_green_minutes int NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS dining_wait_orange_minutes int NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS dining_wait_red_minutes int NOT NULL DEFAULT 30;

COMMENT ON COLUMN public.restaurants.dining_wait_green_minutes IS
  'Plan salle : passage du point bleu au vert (minutes depuis le premier envoi).';
COMMENT ON COLUMN public.restaurants.dining_wait_orange_minutes IS
  'Plan salle : passage au orange.';
COMMENT ON COLUMN public.restaurants.dining_wait_red_minutes IS
  'Plan salle : passage au rouge.';

ALTER TABLE public.dining_orders
  ADD COLUMN IF NOT EXISTS kitchen_ready_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS kitchen_ready_ack_at timestamptz,
  ADD COLUMN IF NOT EXISTS bar_ready_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS bar_ready_ack_at timestamptz;

COMMENT ON COLUMN public.dining_orders.kitchen_ready_notified_at IS
  'Dernier signal « prêt cuisine » non encore acquitté par le serveur.';
COMMENT ON COLUMN public.dining_orders.kitchen_ready_ack_at IS
  'Serveur a vu le clignotement cuisine sur le plan.';
COMMENT ON COLUMN public.dining_orders.bar_ready_notified_at IS
  'Dernier signal « prêt bar » non encore acquitté.';
COMMENT ON COLUMN public.dining_orders.bar_ready_ack_at IS
  'Serveur a vu le clignotement bar sur le plan.';
