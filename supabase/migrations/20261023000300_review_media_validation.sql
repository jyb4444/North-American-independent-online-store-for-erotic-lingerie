-- Persist successful server-side review-media validation so review submission cannot
-- bypass the `complete` step after receiving a signed upload URL.
CREATE TABLE IF NOT EXISTS public.review_media_validations (
  path text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 41943040),
  validated_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz
);

ALTER TABLE public.review_media_validations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.review_media_validations FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.review_media_validations TO service_role;

UPDATE storage.buckets
SET file_size_limit = 41943040,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']::text[]
WHERE id = 'ugc';
