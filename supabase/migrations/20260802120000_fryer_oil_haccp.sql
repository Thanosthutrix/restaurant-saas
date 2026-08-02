-- Module HACCP huile de friteuse (TPM, filtration, changement d'huile).
-- Même logique que temperature_points → temperature_tasks → temperature_logs.

CREATE TABLE IF NOT EXISTS fryer_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text NOT NULL DEFAULT '',
  capacity_liters numeric,
  oil_temp_min_celsius numeric NOT NULL DEFAULT 160,
  oil_temp_max_celsius numeric NOT NULL DEFAULT 190,
  tpm_alert_threshold_pct numeric NOT NULL DEFAULT 22,
  tpm_change_threshold_pct numeric NOT NULL DEFAULT 25,
  recurrence_type text NOT NULL DEFAULT 'daily',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fryer_units_name_non_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT chk_fryer_units_recurrence CHECK (recurrence_type IN ('daily', 'per_service')),
  CONSTRAINT chk_fryer_units_temp_range CHECK (oil_temp_min_celsius < oil_temp_max_celsius),
  CONSTRAINT chk_fryer_units_tpm_thresholds CHECK (
    tpm_alert_threshold_pct > 0
    AND tpm_change_threshold_pct > tpm_alert_threshold_pct
    AND tpm_change_threshold_pct <= 40
  )
);

CREATE INDEX IF NOT EXISTS idx_fryer_units_restaurant ON fryer_units (restaurant_id);

COMMENT ON TABLE fryer_units IS 'Friteuses suivies HACCP : contrôle TPM, température huile, filtration.';
COMMENT ON COLUMN fryer_units.tpm_alert_threshold_pct IS 'Seuil alerte TPM (% matières polaires) — défaut 22 % (DGCCRF).';
COMMENT ON COLUMN fryer_units.tpm_change_threshold_pct IS 'Changement d''huile obligatoire — défaut 25 % TPM.';

CREATE TABLE IF NOT EXISTS fryer_oil_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  fryer_unit_id uuid NOT NULL REFERENCES fryer_units(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  end_reason text,
  oil_product_name text,
  initial_volume_liters numeric,
  recorded_by_display text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fryer_oil_batches_end_reason CHECK (
    end_reason IS NULL
    OR end_reason IN ('tpm_threshold', 'quality', 'scheduled', 'other')
  )
);

CREATE INDEX IF NOT EXISTS idx_fryer_oil_batches_unit_started
  ON fryer_oil_batches (fryer_unit_id, started_at DESC);

COMMENT ON TABLE fryer_oil_batches IS 'Cycle de vie d''une charge d''huile (du remplissage au changement).';

CREATE TABLE IF NOT EXISTS fryer_oil_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  fryer_unit_id uuid NOT NULL REFERENCES fryer_units(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fryer_oil_tasks_status CHECK (status IN ('pending', 'completed')),
  CONSTRAINT uq_fryer_oil_tasks_unit_period UNIQUE (fryer_unit_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_fryer_oil_tasks_restaurant_status
  ON fryer_oil_tasks (restaurant_id, status, due_at);

CREATE TABLE IF NOT EXISTS fryer_oil_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  fryer_unit_id uuid NOT NULL REFERENCES fryer_units(id) ON DELETE CASCADE,
  oil_batch_id uuid REFERENCES fryer_oil_batches(id) ON DELETE SET NULL,
  task_id uuid REFERENCES fryer_oil_tasks(id) ON DELETE SET NULL,
  tpm_percent numeric,
  tpm_test_method text NOT NULL DEFAULT 'strip',
  oil_temperature_celsius numeric NOT NULL,
  filtration_done boolean NOT NULL DEFAULT false,
  quality_ok boolean NOT NULL DEFAULT true,
  quality_issues text,
  log_status text NOT NULL,
  change_oil_required boolean NOT NULL DEFAULT false,
  oil_changed boolean NOT NULL DEFAULT false,
  recorded_by_user_id uuid,
  recorded_by_display text,
  comment text,
  corrective_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fryer_oil_logs_status CHECK (log_status IN ('normal', 'alert', 'critical')),
  CONSTRAINT chk_fryer_oil_logs_tpm_method CHECK (
    tpm_test_method IN ('strip', 'meter', 'visual_estimated')
  ),
  CONSTRAINT chk_fryer_oil_logs_tpm_range CHECK (
    tpm_percent IS NULL OR (tpm_percent >= 0 AND tpm_percent <= 40)
  ),
  CONSTRAINT chk_fryer_oil_logs_temp_range CHECK (
    oil_temperature_celsius >= 80 AND oil_temperature_celsius <= 220
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_fryer_oil_logs_task
  ON fryer_oil_logs (task_id) WHERE task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fryer_oil_logs_restaurant_created
  ON fryer_oil_logs (restaurant_id, created_at DESC);

COMMENT ON TABLE fryer_oil_logs IS 'Contrôles quotidiens huile : TPM, T°, filtration, qualité visuelle/olfactive.';
COMMENT ON COLUMN fryer_oil_logs.filtration_done IS 'Filtration de l''huile effectuée ce jour (bonne pratique HACCP restauration).';
COMMENT ON COLUMN fryer_oil_logs.quality_ok IS 'Pas d''odeur rance, mousse excessive ni fumée anormale.';
COMMENT ON COLUMN fryer_oil_logs.change_oil_required IS 'Changement d''huile requis (TPM ou qualité).';
