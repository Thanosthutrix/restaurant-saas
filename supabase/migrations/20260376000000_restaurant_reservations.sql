-- Réservations : prises (téléphone, comptoir, site…), liées optionnellement à la base clients.

CREATE TABLE IF NOT EXISTS public.restaurant_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.restaurant_customers(id) ON DELETE SET NULL,
  party_size int NOT NULL CHECK (party_size >= 1 AND party_size <= 50),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN (
      'pending',
      'confirmed',
      'seated',
      'completed',
      'cancelled',
      'no_show'
    )
  ),
  contact_name text,
  contact_phone text,
  contact_email text,
  notes text,
  source text NOT NULL DEFAULT 'phone' CHECK (source IN ('phone', 'walk_in', 'website', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  CONSTRAINT chk_reservation_ends_after_start CHECK (ends_at > starts_at),
  CONSTRAINT chk_reservation_contact_or_customer CHECK (
    customer_id IS NOT NULL
    OR (contact_name IS NOT NULL AND length(trim(contact_name)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_starts
  ON public.restaurant_reservations (restaurant_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_reservations_restaurant_status
  ON public.restaurant_reservations (restaurant_id, status);

COMMENT ON TABLE public.restaurant_reservations IS 'Livre de réservations (créneau, couverts, fiche client optionnelle).';

COMMENT ON COLUMN public.restaurant_reservations.status IS
  'pending | confirmed | seated | completed | cancelled | no_show';

-- Liste des réservations pour un jour calendaire (Europe/Paris) — évite le calcul de offsets côté app.
CREATE OR REPLACE FUNCTION public.list_reservations_paris_day(
  p_restaurant_id uuid,
  p_ymd date
)
RETURNS SETOF public.restaurant_reservations
LANGUAGE SQL
STABLE
AS $$
  SELECT r.*
  FROM public.restaurant_reservations r
  WHERE r.restaurant_id = p_restaurant_id
    AND (r.starts_at AT TIME ZONE 'Europe/Paris')::date = p_ymd
  ORDER BY r.starts_at;
$$;

COMMENT ON FUNCTION public.list_reservations_paris_day IS 'Réservations dont le début tombe un jour donné (calendrier Paris).';

-- Combine jour + heure (horloge Paris) en timestamptz UTC.
CREATE OR REPLACE FUNCTION public.reservation_starts_utc(
  p_ymd date,
  p_t time
)
RETURNS timestamptz
LANGUAGE SQL
STABLE
AS $$
  SELECT (p_ymd + p_t) AT TIME ZONE 'Europe/Paris';
$$;

CREATE OR REPLACE FUNCTION public.touch_restaurant_reservations_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_restaurant_reservations_updated ON public.restaurant_reservations;
CREATE TRIGGER trg_restaurant_reservations_updated
  BEFORE UPDATE ON public.restaurant_reservations
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_restaurant_reservations_updated_at();
