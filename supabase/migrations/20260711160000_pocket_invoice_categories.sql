-- Bilan « Ma poche » v2 : dépenses précises par FACTURES réelles.
-- 1) Poste comptable sur chaque facture fournisseur (classé par l'IA, corrigeable).
-- 2) Poste + périodicité sur les charges récurrentes manuelles (loyer, emprunt…).

-- Postes : matieres | rh | locaux | entretien | prestataires | marketing_banque | impots_taxes | financier

-- ── Factures fournisseurs ────────────────────────────────────────────────────
ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS expense_category text;

ALTER TABLE public.supplier_invoices
  DROP CONSTRAINT IF EXISTS chk_supplier_invoices_expense_category;
ALTER TABLE public.supplier_invoices
  ADD CONSTRAINT chk_supplier_invoices_expense_category CHECK (
    expense_category IS NULL OR expense_category IN (
      'matieres', 'rh', 'locaux', 'entretien', 'prestataires',
      'marketing_banque', 'impots_taxes', 'financier'
    )
  );

-- Historique : le pipeline factures ne servait qu'aux achats alimentaires.
UPDATE public.supplier_invoices
  SET expense_category = 'matieres'
  WHERE expense_category IS NULL;

COMMENT ON COLUMN public.supplier_invoices.expense_category IS
  'Poste comptable de la dépense (bilan « Ma poche ») — classé par l''IA à l''analyse, corrigeable.';

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_pocket
  ON public.supplier_invoices (restaurant_id, invoice_date, expense_category);

-- ── Charges récurrentes manuelles ────────────────────────────────────────────
ALTER TABLE public.restaurant_fixed_charges
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'locaux';
ALTER TABLE public.restaurant_fixed_charges
  ADD COLUMN IF NOT EXISTS periodicity text NOT NULL DEFAULT 'monthly';

ALTER TABLE public.restaurant_fixed_charges
  DROP CONSTRAINT IF EXISTS chk_fixed_charges_category;
ALTER TABLE public.restaurant_fixed_charges
  ADD CONSTRAINT chk_fixed_charges_category CHECK (
    category IN (
      'matieres', 'rh', 'locaux', 'entretien', 'prestataires',
      'marketing_banque', 'impots_taxes', 'financier'
    )
  );

ALTER TABLE public.restaurant_fixed_charges
  DROP CONSTRAINT IF EXISTS chk_fixed_charges_periodicity;
ALTER TABLE public.restaurant_fixed_charges
  ADD CONSTRAINT chk_fixed_charges_periodicity CHECK (
    periodicity IN ('monthly', 'quarterly', 'yearly')
  );

COMMENT ON COLUMN public.restaurant_fixed_charges.periodicity IS
  'Périodicité du montant saisi : monthly / quarterly / yearly — proratisée par jour dans le bilan.';
