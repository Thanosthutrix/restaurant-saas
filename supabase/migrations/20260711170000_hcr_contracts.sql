-- Brouillons de contrats de travail HCR générés depuis l'assistant RH.
CREATE TABLE IF NOT EXISTS public.hcr_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  staff_member_id uuid REFERENCES public.staff_members(id) ON DELETE SET NULL,
  contract_kind text NOT NULL CHECK (contract_kind IN ('cdi', 'cdd', 'saisonnier', 'extra')),
  employee_first_name text NOT NULL,
  employee_last_name text NOT NULL,
  title text NOT NULL,
  draft_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'exported')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_hcr_contracts_title_non_empty CHECK (length(trim(title)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_hcr_contracts_restaurant_updated
  ON public.hcr_contracts (restaurant_id, updated_at DESC);

COMMENT ON TABLE public.hcr_contracts IS
  'Brouillons de contrats HCR (CDI, CDD, saisonnier, extra) générés depuis Pilotage > RH > Contrats.';

COMMENT ON COLUMN public.hcr_contracts.draft_json IS
  'Snapshot JSON du wizard (HcrContractDraft) pour réouverture et export PDF.';

ALTER TABLE public.hcr_contracts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_hcr_contracts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hcr_contracts_updated ON public.hcr_contracts;
CREATE TRIGGER trg_hcr_contracts_updated
  BEFORE UPDATE ON public.hcr_contracts
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_hcr_contracts_updated_at();
