-- Moyens de paiement : carte, espèces, chèques (remplace « other »).

UPDATE public.dining_order_payments
SET payment_method = 'cheque'
WHERE payment_method = 'other';

ALTER TABLE public.dining_order_payments
  DROP CONSTRAINT IF EXISTS dining_order_payments_payment_method_check;

ALTER TABLE public.dining_order_payments
  ADD CONSTRAINT dining_order_payments_payment_method_check
  CHECK (payment_method IN ('cash', 'card', 'cheque'));
