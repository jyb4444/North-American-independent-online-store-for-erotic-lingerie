-- ============================================================
-- Self Love — Review photo URL storage
-- ============================================================

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';
