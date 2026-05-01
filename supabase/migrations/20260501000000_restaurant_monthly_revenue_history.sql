-- Historique CA mensuel importé pendant l'onboarding ou via l'assistant IA.
CREATE TABLE IF NOT EXISTS restaurant_monthly_revenues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  month date NOT NULL,
  revenue_ttc numeric,
  revenue_ht numeric,
  source_label text,
  notes text,
  analysis_result_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_restaurant_monthly_revenues_amounts CHECK (
    (revenue_ttc IS NULL OR revenue_ttc >= 0)
    AND (revenue_ht IS NULL OR revenue_ht >= 0)
  ),
  CONSTRAINT uq_restaurant_monthly_revenues_month UNIQUE (restaurant_id, month)
);

CREATE INDEX IF NOT EXISTS idx_restaurant_monthly_revenues_restaurant_month
  ON restaurant_monthly_revenues(restaurant_id, month DESC);

COMMENT ON TABLE restaurant_monthly_revenues IS 'Historique mensuel de CA importé manuellement ou par IA, utilisé pour futures projections.';
