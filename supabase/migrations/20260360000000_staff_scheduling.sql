-- Planning équipe : collaborateurs, shifts planifiés, pointages (prévu vs réalisé).

CREATE TABLE IF NOT EXISTS public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role_label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_staff_display_name CHECK (length(trim(display_name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_member_restaurant_user
  ON public.staff_members (restaurant_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_members_restaurant
  ON public.staff_members (restaurant_id)
  WHERE active = true;

CREATE TABLE IF NOT EXISTS public.work_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  staff_member_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_work_shift_times CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_work_shifts_restaurant_starts ON public.work_shifts (restaurant_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_work_shifts_staff_starts ON public.work_shifts (staff_member_id, starts_at);

CREATE TABLE IF NOT EXISTS public.shift_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_shift_id uuid NOT NULL REFERENCES public.work_shifts(id) ON DELETE CASCADE,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_shift_attendance_shift UNIQUE (work_shift_id),
  CONSTRAINT chk_shift_attendance_order CHECK (
    clock_out_at IS NULL OR clock_in_at IS NULL OR clock_out_at >= clock_in_at
  )
);

COMMENT ON TABLE public.staff_members IS 'Membres d’équipe par restaurant ; user_id optionnel pour pointage depuis leur compte.';
COMMENT ON TABLE public.work_shifts IS 'Créneaux planifiés (début / fin).';
COMMENT ON TABLE public.shift_attendance IS 'Pointage réel lié au shift (écarts vs work_shifts calculés en app).';

CREATE OR REPLACE FUNCTION public.touch_staff_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staff_members_updated ON public.staff_members;
CREATE TRIGGER trg_staff_members_updated
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_staff_members_updated_at();

CREATE OR REPLACE FUNCTION public.touch_work_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_work_shifts_updated ON public.work_shifts;
CREATE TRIGGER trg_work_shifts_updated
  BEFORE UPDATE ON public.work_shifts
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_work_shifts_updated_at();

CREATE OR REPLACE FUNCTION public.touch_shift_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shift_attendance_updated ON public.shift_attendance;
CREATE TRIGGER trg_shift_attendance_updated
  BEFORE UPDATE ON public.shift_attendance
  FOR EACH ROW
  EXECUTE PROCEDURE public.touch_shift_attendance_updated_at();

CREATE OR REPLACE FUNCTION public.create_shift_attendance_for_new_shift()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.shift_attendance (work_shift_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_work_shift_create_attendance ON public.work_shifts;
CREATE TRIGGER trg_work_shift_create_attendance
  AFTER INSERT ON public.work_shifts
  FOR EACH ROW
  EXECUTE PROCEDURE public.create_shift_attendance_for_new_shift();
