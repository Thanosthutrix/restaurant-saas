-- Relevés de température pour équipements froids (ouverture / fermeture)
-- et registre associé.

CREATE TABLE IF NOT EXISTS public.hygiene_cold_temperature_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  element_id uuid NOT NULL REFERENCES public.hygiene_elements(id) ON DELETE CASCADE,
  event_kind text NOT NULL,
  temperature_celsius numeric(5, 2) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by_user_id uuid,
  recorded_by_display text,
  recorded_by_initials text,
  comment text,
  CONSTRAINT chk_hygiene_cold_temperature_event CHECK (event_kind IN ('opening', 'closing')),
  CONSTRAINT chk_hygiene_cold_temperature_range CHECK (temperature_celsius >= -40 AND temperature_celsius <= 25)
);

CREATE INDEX IF NOT EXISTS idx_hygiene_cold_temp_rest_time
  ON public.hygiene_cold_temperature_readings (restaurant_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_hygiene_cold_temp_element
  ON public.hygiene_cold_temperature_readings (element_id);

COMMENT ON TABLE public.hygiene_cold_temperature_readings IS
  'Relevés °C à l’ouverture ou à la fermeture des équipements froids (registre hygiène).';
COMMENT ON COLUMN public.hygiene_cold_temperature_readings.event_kind IS
  'opening = ouverture, closing = fermeture.';
