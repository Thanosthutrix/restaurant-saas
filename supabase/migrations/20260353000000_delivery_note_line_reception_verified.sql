-- Contrôle terrain : la ligne est marquée une fois le produit vérifié physiquement.

ALTER TABLE public.delivery_note_lines
  ADD COLUMN IF NOT EXISTS reception_line_verified_at timestamptz;

COMMENT ON COLUMN public.delivery_note_lines.reception_line_verified_at IS
  'Horodatage lorsque l’opérateur a validé la ligne après contrôle physique (traçabilité).';
