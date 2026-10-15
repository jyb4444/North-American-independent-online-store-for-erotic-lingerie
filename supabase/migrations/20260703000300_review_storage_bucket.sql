-- ============================================================
-- Self Love — Public review media storage bucket
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('ugc', 'ugc', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

DROP POLICY IF EXISTS "Authenticated users can upload review photos"
  ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can upload review media"
  ON storage.objects;

CREATE POLICY "Authenticated users can upload review media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ugc'
    AND auth.role() = 'authenticated'
    AND (
      (storage.foldername(name))[1] = 'reviews'
    )
  );

DROP POLICY IF EXISTS "Anyone can view ugc photos"
  ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view review media"
  ON storage.objects;

CREATE POLICY "Anyone can view review media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ugc');
