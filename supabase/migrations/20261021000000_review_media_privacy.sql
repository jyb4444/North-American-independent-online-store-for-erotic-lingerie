-- Review media must remain private until its parent review is approved.
-- Application APIs use the service role to upload and issue short-lived signed URLs.

UPDATE storage.buckets
SET public = false
WHERE id = 'ugc';

DROP POLICY IF EXISTS "Authenticated users can upload review photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload review media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view ugc photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view review media" ON storage.objects;

-- No client-facing storage policy is recreated. The review API authenticates the user,
-- validates content type/size and stores objects under reviews/<user-id>/.
