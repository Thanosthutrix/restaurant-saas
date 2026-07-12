-- Page Administratif RH : identité employeur (contrats HCR) + investissements.

-- ── Profil employeur sur le restaurant ───────────────────────────────────────
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS legal_form text;
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS siret text;
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS urssaf_office text;
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS representative_name text;
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS representative_role text NOT NULL DEFAULT 'Gérant';
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS collective_agreement_idcc text NOT NULL DEFAULT '1974';
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS retirement_fund text;
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS health_provider text;
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS medecine_travail_organisme text;

COMMENT ON COLUMN public.restaurants.legal_name IS
  'Raison sociale employeur — préremplit les contrats HCR.';
COMMENT ON COLUMN public.restaurants.siret IS
  'SIRET de l''établissement employeur.';
COMMENT ON COLUMN public.restaurants.urssaf_office IS
  'Caisse URSSAF de rattachement.';
COMMENT ON COLUMN public.restaurants.collective_agreement_idcc IS
  'IDCC de la convention collective (défaut 1974 HCR).';

-- ── Investissements & amortissements ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.restaurant_investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  label text NOT NULL,
  expense_category text NOT NULL DEFAULT 'financier',
  acquisition_date date,
  amount_total numeric NOT NULL,
  amortization_years integer,
  monthly_amortization numeric,
  supplier_invoice_id uuid REFERENCES public.supplier_invoices(id) ON DELETE SET NULL,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_investments_label_non_empty CHECK (length(trim(label)) > 0),
  CONSTRAINT chk_investments_amount CHECK (amount_total >= 0),
  CONSTRAINT chk_investments_years CHECK (amortization_years IS NULL OR amortization_years > 0),
  CONSTRAINT chk_investments_monthly CHECK (monthly_amortization IS NULL OR monthly_amortization >= 0),
  CONSTRAINT chk_investments_category CHECK (
    expense_category IN (
      'matieres', 'rh', 'locaux', 'entretien', 'prestataires',
      'marketing_banque', 'impots_taxes', 'financier'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_restaurant_investments_restaurant
  ON public.restaurant_investments (restaurant_id, expense_category, active);

COMMENT ON TABLE public.restaurant_investments IS
  'Investissements et amortissements par secteur — page Administratif RH.';

ALTER TABLE public.restaurant_investments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_restaurant_investments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restaurant_investments_updated ON public.restaurant_investments;
CREATE TRIGGER trg_restaurant_investments_updated
  BEFORE UPDATE ON public.restaurant_investments
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_restaurant_investments_updated_at();
