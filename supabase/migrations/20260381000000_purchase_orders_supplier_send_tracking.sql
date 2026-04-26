-- Suivi d'envoi des commandes fournisseur (e-mail direct ou canal manuel).
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to_email text,
  ADD COLUMN IF NOT EXISTS sent_channel text;

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS chk_purchase_orders_sent_channel;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT chk_purchase_orders_sent_channel
  CHECK (sent_channel IS NULL OR sent_channel IN ('email', 'whatsapp', 'phone', 'portal'));

COMMENT ON COLUMN public.purchase_orders.sent_at IS
  'Date d’envoi de la commande au fournisseur (ou marquage manuel du canal utilisé).';
COMMENT ON COLUMN public.purchase_orders.sent_to_email IS
  'Adresse fournisseur utilisée pour l’envoi e-mail Resend.';
COMMENT ON COLUMN public.purchase_orders.sent_channel IS
  'Canal d’envoi/partage de la commande fournisseur : email, whatsapp, phone, portal.';
