-- Suivi hygiène : température mesurée à la réception par ligne (°C).

ALTER TABLE public.delivery_note_lines
  ADD COLUMN IF NOT EXISTS received_temperature_celsius numeric;

COMMENT ON COLUMN public.delivery_note_lines.received_temperature_celsius IS
  'Température à la réception du produit (°C), suivi hygiène / traçabilité ; optionnel.';
