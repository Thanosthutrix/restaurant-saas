-- Traçabilité réception : lot, DLC, photos par ligne.

ALTER TABLE public.delivery_note_lines
  ADD COLUMN IF NOT EXISTS lot_number text,
  ADD COLUMN IF NOT EXISTS expiry_date date;

COMMENT ON COLUMN public.delivery_note_lines.lot_number IS 'Numéro de lot fournisseur (traçabilité).';
COMMENT ON COLUMN public.delivery_note_lines.expiry_date IS 'Date limite de consommation / péremption (DLC).';

CREATE TABLE IF NOT EXISTS public.reception_traceability_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  delivery_note_id uuid NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  delivery_note_line_id uuid NOT NULL REFERENCES public.delivery_note_lines(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  element_type text NOT NULL DEFAULT 'ingredient',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_reception_traceability_element_type CHECK (
    element_type IN ('ingredient', 'prep', 'resale', 'other')
  )
);

CREATE INDEX IF NOT EXISTS idx_reception_traceability_photos_restaurant_created
  ON public.reception_traceability_photos (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reception_traceability_photos_line
  ON public.reception_traceability_photos (delivery_note_line_id);

COMMENT ON TABLE public.reception_traceability_photos IS
  'Photos de traçabilité prises à la réception (par ligne BL), classables par type dans le registre.';

COMMENT ON COLUMN public.reception_traceability_photos.element_type IS
  'Catégorie affichée au registre : ingrédient, préparation, revente, autre.';
