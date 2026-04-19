-- Numéro de lot par fiche (attribution au 1er relevé T° fin) — traçabilité / futur code-barres.

ALTER TABLE public.preparation_records
  ADD COLUMN IF NOT EXISTS lot_reference text;

COMMENT ON COLUMN public.preparation_records.lot_reference IS
  'Identifiant unique du lot (ex. LOT-YYYYMMDD-HEX) ; attribué au premier relevé de température de fin.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_preparation_records_restaurant_lot
  ON public.preparation_records (restaurant_id, lot_reference)
  WHERE lot_reference IS NOT NULL;
