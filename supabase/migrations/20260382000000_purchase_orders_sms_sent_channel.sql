-- Autorise le canal SMS pour le marquage d'envoi des commandes fournisseur.
ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS chk_purchase_orders_sent_channel;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT chk_purchase_orders_sent_channel
  CHECK (sent_channel IS NULL OR sent_channel IN ('email', 'whatsapp', 'sms', 'phone', 'portal'));
