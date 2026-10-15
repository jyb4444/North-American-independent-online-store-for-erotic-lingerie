-- ============================================================
-- Self Love — Review media and privacy options
-- ============================================================

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS video_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;
