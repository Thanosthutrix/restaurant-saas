-- Registre des préparations (traçabilité refroidissement, DLC).

CREATE TABLE IF NOT EXISTS public.preparation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  dish_id uuid REFERENCES public.dishes(id) ON DELETE SET NULL,
  label text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  temp_end_celsius numeric(5, 2),
  temp_end_recorded_at timestamptz,
  temp_2h_celsius numeric(5, 2),
  temp_2h_due_at timestamptz,
  temp_2h_recorded_at timestamptz,
  dlc_date date,
  recorded_by_user_id uuid,
  recorded_by_display text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_preparation_label_nonempty CHECK (length(trim(label)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_preparation_records_restaurant_created
  ON public.preparation_records (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_preparation_records_open
  ON public.preparation_records (restaurant_id)
  WHERE temp_end_recorded_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_preparation_records_2h_pending
  ON public.preparation_records (restaurant_id, temp_2h_due_at)
  WHERE temp_end_recorded_at IS NOT NULL AND temp_2h_recorded_at IS NULL;

COMMENT ON TABLE public.preparation_records IS
  'Lot de préparation : T° fin de cuisson/finition, contrôle à +2 h, DLC ; lien optionnel stock ou plat.';

CREATE OR REPLACE FUNCTION public.touch_preparation_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_preparation_records_updated ON public.preparation_records;
CREATE TRIGGER trg_preparation_records_updated
  BEFORE UPDATE ON public.preparation_records
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_preparation_records_updated_at();
