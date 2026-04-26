-- Ligne de commande salle : suivi cuisine « prêt » (notification e-mail client quand toutes les lignes le sont).
ALTER TABLE public.dining_order_lines
  ADD COLUMN IF NOT EXISTS is_prepared boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.dining_order_lines.is_prepared IS
  'Cuisine : true lorsque le plat (ligne) est prêt. Sert à déclencher l’e-mail « commande prête » quand toutes les lignes sont prêtes.';
