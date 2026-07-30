-- Snapshot des modifs validées par le serveur pour le pass cuisine (évite les mises à jour en direct).

ALTER TABLE public.dining_order_lines
  ADD COLUMN IF NOT EXISTS kitchen_mods_snapshot jsonb NULL;

COMMENT ON COLUMN public.dining_order_lines.kitchen_mods_snapshot IS
  'Modifs personnalisation validées par le serveur pour affichage pass cuisine ; null = jamais validé ou en attente.';
