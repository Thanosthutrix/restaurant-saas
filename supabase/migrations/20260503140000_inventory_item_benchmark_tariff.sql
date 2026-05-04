-- Prix de référence issus de la base indicative France (avant BL / factures).
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS reference_purchase_is_benchmark boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.inventory_items.reference_purchase_is_benchmark IS
  'True si reference_purchase_unit_cost_ht provient de la base tarifs indicative France (JSON) ; repasse à false dès saisie manuelle, onboarding prix ou réception.';
