-- Unification liste nettoyage + points de mesure de température
-- Un élément hygiène (frigo, congélateur, chambre froide) peut désormais
-- être aussi un point de mesure HACCP, géré depuis une seule liste.

ALTER TABLE hygiene_elements
  ADD COLUMN IF NOT EXISTS temp_point_enabled    BOOLEAN  NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS temp_min_threshold    NUMERIC,
  ADD COLUMN IF NOT EXISTS temp_max_threshold    NUMERIC,
  ADD COLUMN IF NOT EXISTS temp_recurrence_type  TEXT
    CHECK (temp_recurrence_type IN ('daily', 'per_service'));

ALTER TABLE temperature_points
  ADD COLUMN IF NOT EXISTS hygiene_element_id UUID
    REFERENCES hygiene_elements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS temperature_points_hygiene_element_id_idx
  ON temperature_points (hygiene_element_id);
