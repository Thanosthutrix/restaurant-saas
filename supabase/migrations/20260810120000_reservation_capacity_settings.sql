-- Paramètres de capacité réservation + groupes de tables fusionnables

CREATE TABLE public.reservation_capacity_settings (
  restaurant_id uuid PRIMARY KEY
    REFERENCES public.restaurants(id) ON DELETE CASCADE,

  online_reservations_enabled boolean NOT NULL DEFAULT true,

  default_duration_minutes int NOT NULL DEFAULT 90
    CHECK (default_duration_minutes >= 30 AND default_duration_minutes <= 360
           AND default_duration_minutes % 15 = 0),
  slot_step_minutes int NOT NULL DEFAULT 15
    CHECK (slot_step_minutes IN (15, 30)),
  min_lead_minutes int NOT NULL DEFAULT 30
    CHECK (min_lead_minutes >= 0 AND min_lead_minutes <= 1440),

  -- null = calcul auto depuis le plan de salle
  max_covers_per_slot int
    CHECK (max_covers_per_slot IS NULL OR (max_covers_per_slot >= 1 AND max_covers_per_slot <= 500)),
  -- Plafond couverts en ligne (site + Meta) ; null = part du total selon online_share_pct
  max_online_covers_per_slot int
    CHECK (max_online_covers_per_slot IS NULL OR (max_online_covers_per_slot >= 0 AND max_online_covers_per_slot <= 500)),

  max_party_size_online int NOT NULL DEFAULT 12
    CHECK (max_party_size_online BETWEEN 1 AND 50),
  max_party_size_staff int NOT NULL DEFAULT 50
    CHECK (max_party_size_staff BETWEEN 1 AND 50),

  use_table_capacity boolean NOT NULL DEFAULT true,
  online_share_pct int NOT NULL DEFAULT 100
    CHECK (online_share_pct BETWEEN 0 AND 100),

  enforce_availability_online boolean NOT NULL DEFAULT true,
  enforce_availability_staff boolean NOT NULL DEFAULT false,

  reservation_notify_email text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reservation_capacity_settings IS
  'Limites réservation par restaurant (couverts, durée, part en ligne).';

CREATE OR REPLACE FUNCTION public.touch_reservation_capacity_settings_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_reservation_capacity_settings_updated
  BEFORE UPDATE ON public.reservation_capacity_settings
  FOR EACH ROW EXECUTE PROCEDURE public.touch_reservation_capacity_settings_updated_at();

CREATE TABLE public.dining_table_merge_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  label text NOT NULL,
  table_ids uuid[] NOT NULL,
  capacity int NOT NULL CHECK (capacity >= 2 AND capacity <= 50),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_dining_table_merge_groups_restaurant_label UNIQUE (restaurant_id, label),
  CONSTRAINT dining_table_merge_groups_table_ids_nonempty CHECK (cardinality(table_ids) >= 2)
);

COMMENT ON TABLE public.dining_table_merge_groups IS
  'Combinaisons de tables fusionnables pour grands groupes (ex. T.3 + T.4 → 8 couverts).';

CREATE INDEX idx_dining_table_merge_groups_restaurant
  ON public.dining_table_merge_groups (restaurant_id, is_active);

CREATE OR REPLACE FUNCTION public.touch_dining_table_merge_groups_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_dining_table_merge_groups_updated
  BEFORE UPDATE ON public.dining_table_merge_groups
  FOR EACH ROW EXECUTE PROCEDURE public.touch_dining_table_merge_groups_updated_at();
