-- Fiches de paie RH : période mensuelle, import planning, validation manuelle, bulletin.

CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'imported', 'hours_validated', 'computed', 'finalized')
  ),
  hours_source text NOT NULL DEFAULT 'planned' CHECK (hours_source IN ('planned', 'attendance')),
  imported_at timestamptz,
  hours_validated_at timestamptz,
  computed_at timestamptz,
  finalized_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payroll_period_restaurant_month UNIQUE (restaurant_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_periods_restaurant
  ON public.payroll_periods (restaurant_id, period_month DESC);

COMMENT ON TABLE public.payroll_periods IS
  'Période de paie mensuelle — workflow : import planning → validation heures → calcul → finalisation.';

CREATE TABLE IF NOT EXISTS public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  staff_member_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'hours_validated', 'computed', 'finalized')
  ),
  hours_imported numeric,
  hours_validated numeric,
  hourly_gross_rate numeric,
  gross_total numeric,
  net_before_tax numeric,
  employee_contrib_total numeric,
  employer_contrib_total numeric,
  employer_cost_total numeric,
  employee_snapshot jsonb NOT NULL DEFAULT '{}',
  employer_snapshot jsonb NOT NULL DEFAULT '{}',
  pay_snapshot jsonb NOT NULL DEFAULT '{}',
  benefits_snapshot jsonb NOT NULL DEFAULT '{}',
  alerts jsonb NOT NULL DEFAULT '[]',
  hcr_contract_id uuid REFERENCES public.hcr_contracts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_payslip_period_staff UNIQUE (payroll_period_id, staff_member_id),
  CONSTRAINT chk_payslip_hours_nonneg CHECK (
    (hours_imported IS NULL OR hours_imported >= 0)
    AND (hours_validated IS NULL OR hours_validated >= 0)
  ),
  CONSTRAINT chk_payslip_rate CHECK (
    hourly_gross_rate IS NULL OR (hourly_gross_rate >= 0 AND hourly_gross_rate <= 500)
  )
);

CREATE INDEX IF NOT EXISTS idx_payslips_period
  ON public.payslips (payroll_period_id, status);

CREATE TABLE IF NOT EXISTS public.payslip_hour_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id uuid NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
  work_shift_id uuid REFERENCES public.work_shifts(id) ON DELETE SET NULL,
  day date NOT NULL,
  label text NOT NULL,
  planned_hours numeric NOT NULL DEFAULT 0,
  attendance_hours numeric,
  validated_hours numeric NOT NULL DEFAULT 0,
  is_manual_override boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  CONSTRAINT chk_hour_line_nonneg CHECK (
    planned_hours >= 0 AND validated_hours >= 0
    AND (attendance_hours IS NULL OR attendance_hours >= 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_payslip_hour_lines_payslip
  ON public.payslip_hour_lines (payslip_id, day);

CREATE TABLE IF NOT EXISTS public.payslip_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payslip_id uuid NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (
    section IN ('earning', 'employee_contrib', 'employer_contrib', 'deduction', 'info')
  ),
  code text NOT NULL,
  label text NOT NULL,
  base_amount numeric,
  rate numeric,
  amount numeric NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_payslip_lines_payslip
  ON public.payslip_lines (payslip_id, sort_order);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_hour_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_lines ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_payroll_periods_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_payroll_periods_updated ON public.payroll_periods;
CREATE TRIGGER trg_payroll_periods_updated
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE PROCEDURE public.touch_payroll_periods_updated_at();

CREATE OR REPLACE FUNCTION public.touch_payslips_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_payslips_updated ON public.payslips;
CREATE TRIGGER trg_payslips_updated
  BEFORE UPDATE ON public.payslips
  FOR EACH ROW EXECUTE PROCEDURE public.touch_payslips_updated_at();
