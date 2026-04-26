-- Journal des envois (mail, plus tard SMS / WhatsApp) pour facturation et support.
-- idempotence : un même (restaurant, clé) ne crée qu’un enregistrement d’envoi logique.

CREATE TABLE IF NOT EXISTS public.restaurant_message_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  category text NOT NULL,
  action text NOT NULL,
  to_address text,
  subject text,
  status text NOT NULL CHECK (status IN ('skipped', 'pending', 'sent', 'failed')),
  provider text,
  provider_message_id text,
  idempotency_key text NOT NULL,
  error_detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_message_delivery_restaurant_idem UNIQUE (restaurant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_message_deliveries_restaurant_created
  ON public.restaurant_message_deliveries (restaurant_id, created_at DESC);

COMMENT ON TABLE public.restaurant_message_deliveries IS
  'Traces d’envois transactionnels (email, SMS, WA) par restaurant.';

COMMENT ON COLUMN public.restaurant_message_deliveries.category IS
  'ex. reservation, order';

COMMENT ON COLUMN public.restaurant_message_deliveries.action IS
  'ex. created, confirmed, reminder';

COMMENT ON COLUMN public.restaurant_message_deliveries.status IS
  'skipped = pas d’envoi (pas d’e-mail, pas de clé API, etc.)';
