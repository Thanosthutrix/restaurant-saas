-- Messagerie Meta (Instagram DM + Facebook Messenger) — Phase 1 inbox.

CREATE TABLE IF NOT EXISTS public.restaurant_meta_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook_messenger', 'instagram_dm')),
  external_user_id text NOT NULL,
  customer_name text,
  customer_profile_pic_url text,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  booking_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_meta_conversation_peer UNIQUE (restaurant_id, platform, external_user_id)
);

CREATE INDEX IF NOT EXISTS meta_conversations_restaurant_last_msg_idx
  ON public.restaurant_meta_conversations (restaurant_id, last_message_at DESC NULLS LAST);

COMMENT ON TABLE public.restaurant_meta_conversations IS
  'Conversations Instagram DM / Messenger par établissement (Phase 1 — lecture).';

CREATE TABLE IF NOT EXISTS public.restaurant_meta_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.restaurant_meta_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  meta_message_id text,
  text text,
  attachments jsonb,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS meta_messages_mid_unique_idx
  ON public.restaurant_meta_messages (meta_message_id)
  WHERE meta_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS meta_messages_conversation_created_idx
  ON public.restaurant_meta_messages (conversation_id, created_at ASC);

COMMENT ON TABLE public.restaurant_meta_messages IS
  'Messages individuels reçus ou envoyés via Meta (webhook).';

ALTER TABLE public.restaurant_meta_connections
  ADD COLUMN IF NOT EXISTS messaging_webhook_subscribed_at timestamptz;

COMMENT ON COLUMN public.restaurant_meta_connections.messaging_webhook_subscribed_at IS
  'Horodatage abonnement webhook messages sur la page Facebook liée.';

CREATE OR REPLACE FUNCTION public.touch_restaurant_meta_conversations_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_restaurant_meta_conversations_updated ON public.restaurant_meta_conversations;
CREATE TRIGGER trg_restaurant_meta_conversations_updated
  BEFORE UPDATE ON public.restaurant_meta_conversations
  FOR EACH ROW EXECUTE PROCEDURE public.touch_restaurant_meta_conversations_updated_at();

ALTER TABLE public.restaurant_meta_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_meta_messages ENABLE ROW LEVEL SECURITY;
