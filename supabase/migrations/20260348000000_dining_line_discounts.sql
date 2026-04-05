-- Remises par ligne sur les commandes salle (montant, pourcentage, offert).

ALTER TABLE public.dining_order_lines
  ADD COLUMN IF NOT EXISTS discount_kind text NOT NULL DEFAULT 'none'
    CHECK (discount_kind IN ('none', 'percent', 'amount', 'free')),
  ADD COLUMN IF NOT EXISTS discount_value numeric NULL;

COMMENT ON COLUMN public.dining_order_lines.discount_kind IS 'none | percent | amount | free (offert)';
COMMENT ON COLUMN public.dining_order_lines.discount_value IS 'Pourcentage (0–100) ou montant TTC de remise sur la ligne';

-- Encaissement à 0 € possible (ex. tout offert après remises).
ALTER TABLE public.dining_order_payments
  DROP CONSTRAINT IF EXISTS chk_dining_payment_amount;

ALTER TABLE public.dining_order_payments
  ADD CONSTRAINT chk_dining_payment_amount CHECK (amount_ttc >= 0);
