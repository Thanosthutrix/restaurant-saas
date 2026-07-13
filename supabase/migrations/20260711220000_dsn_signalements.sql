-- Signalements DSN événementiels (arrêt maladie, reprise, fin de contrat).

CREATE TABLE IF NOT EXISTS public.payroll_dsn_signalements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  staff_member_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('arret_travail', 'reprise_arret', 'fin_contrat')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'exported')),
  event_date date NOT NULL,
  last_worked_day date,
  expected_end_date date,
  return_date date,
  contract_end_date date,
  motif_code text NOT NULL,
  subrogation boolean NOT NULL DEFAULT false,
  linked_arret_id uuid REFERENCES public.payroll_dsn_signalements(id) ON DELETE SET NULL,
  employee_snapshot jsonb NOT NULL DEFAULT '{}',
  employer_snapshot jsonb NOT NULL DEFAULT '{}',
  notes text,
  exported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_dsn_signalements_restaurant
  ON public.payroll_dsn_signalements (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_dsn_signalements_staff
  ON public.payroll_dsn_signalements (staff_member_id, kind);

COMMENT ON TABLE public.payroll_dsn_signalements IS
  'Signalements DSN événementiels — arrêt (04), reprise (05), fin de contrat unique (07).';

CREATE OR REPLACE FUNCTION public.touch_payroll_dsn_signalements_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_dsn_signalements_updated ON public.payroll_dsn_signalements;
CREATE TRIGGER trg_payroll_dsn_signalements_updated
  BEFORE UPDATE ON public.payroll_dsn_signalements
  FOR EACH ROW EXECUTE PROCEDURE public.touch_payroll_dsn_signalements_updated_at();

-- Étendre l'historique DSN pour les signalements
ALTER TABLE public.payroll_dsn_exports
  ALTER COLUMN payroll_period_id DROP NOT NULL;

ALTER TABLE public.payroll_dsn_exports
  ADD COLUMN IF NOT EXISTS signalement_id uuid REFERENCES public.payroll_dsn_signalements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS export_kind text NOT NULL DEFAULT 'mensuelle';

ALTER TABLE public.payroll_dsn_exports
  DROP CONSTRAINT IF EXISTS chk_payroll_dsn_exports_kind;

ALTER TABLE public.payroll_dsn_exports
  ADD CONSTRAINT chk_payroll_dsn_exports_kind CHECK (
    export_kind IN ('mensuelle', 'arret_travail', 'reprise_arret', 'fin_contrat')
  );

ALTER TABLE public.payroll_dsn_signalements ENABLE ROW LEVEL SECURITY;

COMMENT ON COLUMN public.payroll_dsn_exports.export_kind IS
  'mensuelle | arret_travail | reprise_arret | fin_contrat';
