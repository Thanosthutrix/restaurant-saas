-- Congés validés et indisponibilités datés par collaborateur.
-- Remplace l'ancien `unavailableStaffIds` éphémère du wizard : ces lignes sont persistées
-- et ingérées automatiquement à l'Étape 3 (contraintes humaines) pour la semaine ciblée.
CREATE TABLE IF NOT EXISTS public.staff_leave (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  staff_member_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  day date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('leave', 'unavailable')),
  status text NOT NULL DEFAULT 'validated' CHECK (status IN ('pending', 'validated')),
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_staff_leave_member_day_kind UNIQUE (staff_member_id, day, kind)
);

COMMENT ON TABLE public.staff_leave IS
  'Congés validés (kind=leave) et indisponibilités (kind=unavailable) datés. Source RH du wizard de planning.';
COMMENT ON COLUMN public.staff_leave.kind IS 'leave = congé posé/validé ; unavailable = indisponibilité ponctuelle.';
COMMENT ON COLUMN public.staff_leave.status IS 'validated = pris en compte par l''algorithme ; pending = en attente.';

CREATE INDEX IF NOT EXISTS idx_staff_leave_restaurant_day
  ON public.staff_leave (restaurant_id, day);
CREATE INDEX IF NOT EXISTS idx_staff_leave_member
  ON public.staff_leave (staff_member_id, day);
