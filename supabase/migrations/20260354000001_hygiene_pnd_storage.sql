-- Bucket Storage pour preuves photo (tâches critiques).

INSERT INTO storage.buckets (id, name, public)
VALUES ('hygiene-proofs', 'hygiene-proofs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow anon insert hygiene-proofs" ON storage.objects;
CREATE POLICY "Allow anon insert hygiene-proofs"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'hygiene-proofs');

DROP POLICY IF EXISTS "Allow authenticated insert hygiene-proofs" ON storage.objects;
CREATE POLICY "Allow authenticated insert hygiene-proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'hygiene-proofs');

DROP POLICY IF EXISTS "Allow public read hygiene-proofs" ON storage.objects;
CREATE POLICY "Allow public read hygiene-proofs"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'hygiene-proofs');
