-- Base clients : fiches, tags, journal d’activité, traçabilité des consentements (RGPD).

CREATE TABLE IF NOT EXISTS public.customer_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_customer_tags_label_nonempty CHECK (length(trim(label)) > 0),
  CONSTRAINT uq_customer_tags_restaurant_label UNIQUE (restaurant_id, label)
);

CREATE INDEX IF NOT EXISTS idx_customer_tags_restaurant ON public.customer_tags(restaurant_id);

COMMENT ON TABLE public.customer_tags IS 'Étiquettes segmentables pour les clients (VIP, entreprise, allergie, …).';

CREATE TABLE IF NOT EXISTS public.restaurant_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  first_name text,
  last_name text,
  email text,
  phone text,
  phone_normalized text,
  preferred_locale text NOT NULL DEFAULT 'fr',
  birth_date date,
  company_name text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country text NOT NULL DEFAULT 'FR',
  internal_notes text,
  allergens_note text,
  source text NOT NULL DEFAULT 'other',
  marketing_opt_in boolean NOT NULL DEFAULT false,
  marketing_opt_in_at timestamptz,
  service_messages_opt_in boolean NOT NULL DEFAULT true,
  analytics_opt_in boolean NOT NULL DEFAULT false,
  visit_count int NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
  last_visit_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  CONSTRAINT chk_rc_display_name_nonempty CHECK (length(trim(display_name)) > 0),
  CONSTRAINT chk_rc_source CHECK (
    source IN (
      'walk_in',
      'phone',
      'website',
      'referral',
      'social',
      'event',
      'import',
      'other'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_rc_restaurant ON public.restaurant_customers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_rc_restaurant_active_name
  ON public.restaurant_customers(restaurant_id, is_active, display_name);
CREATE INDEX IF NOT EXISTS idx_rc_restaurant_created ON public.restaurant_customers(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rc_email_lower
  ON public.restaurant_customers(restaurant_id, lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';
CREATE INDEX IF NOT EXISTS idx_rc_phone_norm
  ON public.restaurant_customers(restaurant_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL AND phone_normalized <> '';

COMMENT ON TABLE public.restaurant_customers IS 'Clients de l’établissement : contact, préférences, consentements, fréquentation.';
COMMENT ON COLUMN public.restaurant_customers.internal_notes IS 'Notes internes équipe (hors données sensibles médicales détaillées).';
COMMENT ON COLUMN public.restaurant_customers.allergens_note IS 'Rappel allergies / régimes (à traiter avec prudence ; responsabilité du restaurateur).';

CREATE TABLE IF NOT EXISTS public.customer_tag_assignments (
  customer_id uuid NOT NULL REFERENCES public.restaurant_customers(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.customer_tags(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_cta_tag ON public.customer_tag_assignments(tag_id);

CREATE TABLE IF NOT EXISTS public.customer_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.restaurant_customers(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  title text NOT NULL,
  body text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_cte_event_type CHECK (
    event_type IN ('note', 'call', 'email', 'visit', 'consent_change', 'tag_change', 'system')
  )
);

CREATE INDEX IF NOT EXISTS idx_cte_customer_occurred
  ON public.customer_timeline_events(customer_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_cte_restaurant ON public.customer_timeline_events(restaurant_id);

COMMENT ON TABLE public.customer_timeline_events IS 'Journal : notes, appels, visites, changements de consentement / tags.';

CREATE TABLE IF NOT EXISTS public.customer_consent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.restaurant_customers(id) ON DELETE CASCADE,
  consent_key text NOT NULL,
  previous_value boolean,
  new_value boolean NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid,
  notes text,
  CONSTRAINT chk_ccl_consent_key CHECK (
    consent_key IN ('marketing', 'service_messages', 'analytics')
  )
);

CREATE INDEX IF NOT EXISTS idx_ccl_customer_recorded ON public.customer_consent_logs(customer_id, recorded_at DESC);

COMMENT ON TABLE public.customer_consent_logs IS 'Historique des changements de consentement (preuve minimale côté établissement).';

CREATE OR REPLACE FUNCTION public.touch_restaurant_customers_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_restaurant_customers_updated ON public.restaurant_customers;
CREATE TRIGGER trg_restaurant_customers_updated
  BEFORE UPDATE ON public.restaurant_customers
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_restaurant_customers_updated_at();
