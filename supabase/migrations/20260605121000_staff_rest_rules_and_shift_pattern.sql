-- Règles de repos et schéma de shift par défaut, par collaborateur.
-- Alimentent l'Étape 3 (contraintes humaines) et l'Étape 2 (profil) du wizard.
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS planning_fixed_rest_days jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS planning_require_consecutive_rest boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS planning_default_shift_pattern text;

COMMENT ON COLUMN public.staff_members.planning_fixed_rest_days IS
  'Jours de repos fixes récurrents, ex. ["mon"] (lundi). Tableau de clés jour mon..sun.';
COMMENT ON COLUMN public.staff_members.planning_require_consecutive_rest IS
  'SOFT constraint : préférer 2 jours de repos consécutifs pour ce collaborateur.';
COMMENT ON COLUMN public.staff_members.planning_default_shift_pattern IS
  'Schéma de shift par défaut : continuous (journée continue), split (coupure midi/soir), flexible. NULL = non défini.';

-- Garde-fou : valeurs autorisées pour le schéma de shift.
ALTER TABLE public.staff_members
  DROP CONSTRAINT IF EXISTS chk_staff_default_shift_pattern;
ALTER TABLE public.staff_members
  ADD CONSTRAINT chk_staff_default_shift_pattern
  CHECK (planning_default_shift_pattern IS NULL
         OR planning_default_shift_pattern IN ('continuous', 'split', 'flexible'));
