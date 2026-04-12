-- Module Plan de Nettoyage et Désinfection (PND) — V1
-- Référentiel de suggestions (non figé : aide à la saisie ; modifiable par élément).

CREATE TABLE IF NOT EXISTS public.hygiene_recurrence_presets (
  category text PRIMARY KEY,
  default_recurrence_type text NOT NULL,
  recurrence_day_of_week smallint,
  recurrence_day_of_month smallint,
  label_fr text NOT NULL,
  CONSTRAINT chk_hygiene_preset_recurrence CHECK (
    default_recurrence_type IN ('after_each_service', 'daily', 'weekly', 'monthly')
  ),
  CONSTRAINT chk_hygiene_preset_dow CHECK (
    recurrence_day_of_week IS NULL OR (recurrence_day_of_week >= 0 AND recurrence_day_of_week <= 6)
  ),
  CONSTRAINT chk_hygiene_preset_dom CHECK (
    recurrence_day_of_month IS NULL OR (recurrence_day_of_month >= 1 AND recurrence_day_of_month <= 28)
  )
);

COMMENT ON TABLE public.hygiene_recurrence_presets IS
  'Valeurs par défaut de récurrence par catégorie d’élément (suggestions métier, non normatives).';

-- Éléments à nettoyer (configuration par restaurant).

CREATE TABLE IF NOT EXISTS public.hygiene_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  area_label text NOT NULL DEFAULT '',
  description text,
  risk_level text NOT NULL DEFAULT 'standard',
  recurrence_type text NOT NULL DEFAULT 'daily',
  recurrence_day_of_week smallint,
  recurrence_day_of_month smallint,
  cleaning_protocol text NOT NULL DEFAULT '',
  disinfection_protocol text NOT NULL DEFAULT '',
  product_used text,
  dosage text,
  contact_time text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_hygiene_element_category CHECK (
    category IN (
      'plan_travail', 'sol', 'mur', 'chambre_froide', 'frigo', 'congelateur', 'etagere',
      'hotte', 'four', 'piano_plaque', 'trancheuse', 'machine', 'ustensile',
      'bac_gastronorme', 'plonge', 'sanitaire', 'poubelle', 'poignee_contact',
      'zone_dechets', 'reserve', 'vehicule', 'autre'
    )
  ),
  CONSTRAINT chk_hygiene_element_risk CHECK (risk_level IN ('critical', 'important', 'standard')),
  CONSTRAINT chk_hygiene_element_recurrence CHECK (
    recurrence_type IN ('after_each_service', 'daily', 'weekly', 'monthly')
  ),
  CONSTRAINT chk_hygiene_element_dow CHECK (
    recurrence_day_of_week IS NULL OR (recurrence_day_of_week >= 0 AND recurrence_day_of_week <= 6)
  ),
  CONSTRAINT chk_hygiene_element_dom CHECK (
    recurrence_day_of_month IS NULL OR (recurrence_day_of_month >= 1 AND recurrence_day_of_month <= 28)
  )
);

CREATE INDEX IF NOT EXISTS idx_hygiene_elements_restaurant ON public.hygiene_elements (restaurant_id);
CREATE INDEX IF NOT EXISTS idx_hygiene_elements_active ON public.hygiene_elements (restaurant_id, active);

COMMENT ON COLUMN public.hygiene_elements.recurrence_type IS
  'after_each_service : pas de génération auto ; tâches créées à la demande (après service).';

-- Occurrences de tâches (due / réalisée).

CREATE TABLE IF NOT EXISTS public.hygiene_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  element_id uuid NOT NULL REFERENCES public.hygiene_elements(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  due_at timestamptz NOT NULL,
  risk_level text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  completed_by_user_id uuid,
  completed_by_display text,
  completion_comment text,
  proof_photo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_hygiene_task_risk CHECK (risk_level IN ('critical', 'important', 'standard')),
  CONSTRAINT chk_hygiene_task_status CHECK (status IN ('pending', 'completed', 'missed')),
  CONSTRAINT uq_hygiene_task_element_period UNIQUE (element_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_hygiene_tasks_restaurant_due ON public.hygiene_tasks (restaurant_id, due_at);
CREATE INDEX IF NOT EXISTS idx_hygiene_tasks_restaurant_status ON public.hygiene_tasks (restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_hygiene_tasks_element ON public.hygiene_tasks (element_id);

COMMENT ON TABLE public.hygiene_tasks IS
  'Instance de tâche planifiée ; historique de réalisation via statut + completed_* + preuve photo si critique.';
COMMENT ON COLUMN public.hygiene_tasks.period_key IS
  'Clé d’idempotence (ex. d:2025-03-30, w:2025-03-24, m:2025-03, manual:uuid).';

-- Seed référentiel suggestions (crédible terrain, non normatif).

INSERT INTO public.hygiene_recurrence_presets (category, default_recurrence_type, recurrence_day_of_week, recurrence_day_of_month, label_fr)
VALUES
  ('plan_travail', 'daily', NULL, NULL, 'Suggestion : nettoyage quotidien minimum ; renforcer après chaque service si besoin.'),
  ('sol', 'daily', NULL, NULL, 'Suggestion : quotidien / après service selon flux.'),
  ('mur', 'weekly', 1, NULL, 'Suggestion : hebdomadaire (ex. lundi).'),
  ('chambre_froide', 'weekly', 1, NULL, 'Suggestion : hebdomadaire ; adapter selon charge.'),
  ('frigo', 'weekly', 1, NULL, 'Suggestion : hebdomadaire (dépose / contrôle).'),
  ('congelateur', 'monthly', NULL, 1, 'Suggestion : mensuel (1er du mois).'),
  ('etagere', 'weekly', 1, NULL, 'Suggestion : hebdomadaire.'),
  ('hotte', 'monthly', NULL, 1, 'Suggestion : mensuel minimum ; selon usage intensif.'),
  ('four', 'weekly', 1, NULL, 'Suggestion : hebdomadaire.'),
  ('piano_plaque', 'daily', NULL, NULL, 'Suggestion : quotidien / après service.'),
  ('trancheuse', 'daily', NULL, NULL, 'Suggestion : quotidien ; désinfection fréquente si contact aliments.'),
  ('machine', 'weekly', 1, NULL, 'Suggestion : hebdomadaire selon machine.'),
  ('ustensile', 'after_each_service', NULL, NULL, 'Suggestion : après usage critique ou fin de service.'),
  ('bac_gastronorme', 'daily', NULL, NULL, 'Suggestion : quotidien / après service.'),
  ('plonge', 'daily', NULL, NULL, 'Suggestion : quotidien / après chaque service.'),
  ('sanitaire', 'daily', NULL, NULL, 'Suggestion : quotidien minimum.'),
  ('poubelle', 'daily', NULL, NULL, 'Suggestion : quotidien ; vidange selon flux.'),
  ('poignee_contact', 'daily', NULL, NULL, 'Suggestion : quotidien (points de contact).'),
  ('zone_dechets', 'daily', NULL, NULL, 'Suggestion : quotidien.'),
  ('reserve', 'weekly', 1, NULL, 'Suggestion : hebdomadaire.'),
  ('vehicule', 'monthly', NULL, 1, 'Suggestion : mensuel si livraison interne.'),
  ('autre', 'weekly', 1, NULL, 'Suggestion : hebdomadaire par défaut ; à adapter.')
ON CONFLICT (category) DO NOTHING;

CREATE OR REPLACE FUNCTION public.touch_hygiene_elements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hygiene_elements_updated ON public.hygiene_elements;
CREATE TRIGGER trg_hygiene_elements_updated
  BEFORE UPDATE ON public.hygiene_elements
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_hygiene_elements_updated_at();
