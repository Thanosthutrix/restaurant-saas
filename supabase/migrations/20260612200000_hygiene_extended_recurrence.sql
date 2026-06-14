-- ─── 1. Nouvelles fréquences de nettoyage ──────────────────────────────────────

ALTER TABLE public.hygiene_elements
  DROP CONSTRAINT IF EXISTS chk_hygiene_element_recurrence;

ALTER TABLE public.hygiene_elements
  ADD CONSTRAINT chk_hygiene_element_recurrence CHECK (
    recurrence_type IN (
      'after_each_service',
      'daily',
      'twice_a_week',
      'three_times_a_week',
      'weekly',
      'bimonthly',
      'monthly',
      'quarterly',
      'annual'
    )
  );

ALTER TABLE public.hygiene_recurrence_presets
  DROP CONSTRAINT IF EXISTS chk_hygiene_preset_recurrence;

ALTER TABLE public.hygiene_recurrence_presets
  ADD CONSTRAINT chk_hygiene_preset_recurrence CHECK (
    default_recurrence_type IN (
      'after_each_service',
      'daily',
      'twice_a_week',
      'three_times_a_week',
      'weekly',
      'bimonthly',
      'monthly',
      'quarterly',
      'annual'
    )
  );

-- ─── 2. Double entretien par machine ───────────────────────────────────────────

ALTER TABLE public.hygiene_elements
  ADD COLUMN IF NOT EXISTS secondary_recurrence_type text
    CHECK (secondary_recurrence_type IN (
      'after_each_service',
      'daily',
      'twice_a_week',
      'three_times_a_week',
      'weekly',
      'bimonthly',
      'monthly',
      'quarterly',
      'annual'
    )),
  ADD COLUMN IF NOT EXISTS secondary_recurrence_day_of_week  integer
    CHECK (secondary_recurrence_day_of_week BETWEEN 0 AND 6),
  ADD COLUMN IF NOT EXISTS secondary_recurrence_day_of_month integer
    CHECK (secondary_recurrence_day_of_month BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS secondary_cleaning_protocol       text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS secondary_disinfection_protocol   text NOT NULL DEFAULT '';

-- plan 0 = protocole principal, plan 1 = protocole secondaire
ALTER TABLE public.hygiene_tasks
  ADD COLUMN IF NOT EXISTS maintenance_plan smallint NOT NULL DEFAULT 0
    CHECK (maintenance_plan IN (0, 1));

-- La clé unique doit inclure maintenance_plan pour ne pas bloquer deux plans le même jour
ALTER TABLE public.hygiene_tasks
  DROP CONSTRAINT IF EXISTS uq_hygiene_task_element_period;

ALTER TABLE public.hygiene_tasks
  ADD CONSTRAINT uq_hygiene_task_element_period
    UNIQUE (element_id, period_key, maintenance_plan);

-- ─── 3. Jours de fermeture du restaurant ───────────────────────────────────────

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS closed_days_of_week integer[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.restaurants.closed_days_of_week IS
  '0=dimanche, 1=lundi, …, 6=samedi (UTC getUTCDay). Tâches HACCP et nettoyage non générées ces jours-là.';
