-- Permet à chaque collaborateur de choisir son code couleur dans le planning.
-- Valeur 0-9 (index dans la palette STAFF_COLORS) ; NULL = attribution automatique par tri d'id.
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS color_index smallint CHECK (color_index BETWEEN 0 AND 9);
