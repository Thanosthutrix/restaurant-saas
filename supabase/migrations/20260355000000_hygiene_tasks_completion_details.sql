-- Détail d’intervention : type (nettoyage / désinfection / les deux) et initiales terrain.

ALTER TABLE public.hygiene_tasks
  ADD COLUMN IF NOT EXISTS cleaning_action_type text,
  ADD COLUMN IF NOT EXISTS completed_by_initials text;

ALTER TABLE public.hygiene_tasks DROP CONSTRAINT IF EXISTS chk_hygiene_task_cleaning_action;
ALTER TABLE public.hygiene_tasks ADD CONSTRAINT chk_hygiene_task_cleaning_action CHECK (
  cleaning_action_type IS NULL OR cleaning_action_type IN ('cleaning', 'disinfection', 'both')
);

COMMENT ON COLUMN public.hygiene_tasks.cleaning_action_type IS
  'Nature de l’intervention : nettoyage, désinfection, ou les deux.';
COMMENT ON COLUMN public.hygiene_tasks.completed_by_initials IS
  'Initiales saisies par l’opérateur (complément du compte connecté).';
