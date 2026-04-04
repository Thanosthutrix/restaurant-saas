-- Policies Storage pour le bucket delivery-notes (BL).
-- Sans ces policies, l'upload côté client (anon) échoue avec "new row violates row-level security policy".

-- INSERT : autoriser anon et authenticated à uploader dans delivery-notes
DROP POLICY IF EXISTS "Allow anon insert delivery-notes" ON storage.objects;
CREATE POLICY "Allow anon insert delivery-notes"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'delivery-notes');

DROP POLICY IF EXISTS "Allow authenticated insert delivery-notes" ON storage.objects;
CREATE POLICY "Allow authenticated insert delivery-notes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'delivery-notes');

-- SELECT : autoriser la lecture (URL publique, getPublicUrl)
DROP POLICY IF EXISTS "Allow public read delivery-notes" ON storage.objects;
CREATE POLICY "Allow public read delivery-notes"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'delivery-notes');
