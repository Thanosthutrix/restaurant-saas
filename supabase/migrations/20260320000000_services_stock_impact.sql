-- Résultat de l'impact stock lors de l'enregistrement d'un service (plats appliqués / ignorés, avertissements).
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS stock_impact_json jsonb;

COMMENT ON COLUMN services.stock_impact_json IS 'Résultat du calcul et de l''application du stock à l''enregistrement : applied_count, skipped_count, warnings.';
