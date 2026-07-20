-- Tokens push natifs (Capacitor) par utilisateur / appareil.

CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS user_push_tokens_restaurant_id_idx
  ON public.user_push_tokens (restaurant_id);

COMMENT ON TABLE public.user_push_tokens IS
  'Tokens FCM/APNs enregistrés depuis l''app Capacitor pour notifications push par utilisateur.';

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_push_tokens_select_own ON public.user_push_tokens
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY user_push_tokens_insert_own ON public.user_push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_push_tokens_update_own ON public.user_push_tokens
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_push_tokens_delete_own ON public.user_push_tokens
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
