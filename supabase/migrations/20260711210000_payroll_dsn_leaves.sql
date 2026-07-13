-- Export DSN + solde congés payés salariés.

CREATE TABLE IF NOT EXISTS public.payroll_dsn_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  norm_version text NOT NULL DEFAULT 'P26V01',
  file_mode text NOT NULL DEFAULT 'real' CHECK (file_mode IN ('test', 'real')),
  payslip_count integer NOT NULL DEFAULT 0,
  line_count integer NOT NULL DEFAULT 0,
  total_gross numeric NOT NULL DEFAULT 0,
  total_employer_contrib numeric NOT NULL DEFAULT 0,
  warnings jsonb NOT NULL DEFAULT '[]',
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payroll_dsn_exports_period
  ON public.payroll_dsn_exports (payroll_period_id, generated_at DESC);

ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS paid_leave_balance_days numeric NOT NULL DEFAULT 0;

ALTER TABLE public.staff_members
  DROP CONSTRAINT IF EXISTS chk_staff_members_paid_leave_balance;

ALTER TABLE public.staff_members
  ADD CONSTRAINT chk_staff_members_paid_leave_balance CHECK (
    paid_leave_balance_days >= 0 AND paid_leave_balance_days <= 500
  );

COMMENT ON COLUMN public.staff_members.paid_leave_balance_days IS
  'Solde congés payés (jours ouvrables) — mis à jour manuellement ou via finalisation paie.';

COMMENT ON TABLE public.payroll_dsn_exports IS
  'Historique des exports DSN mensuels générés depuis les bulletins finalisés.';
