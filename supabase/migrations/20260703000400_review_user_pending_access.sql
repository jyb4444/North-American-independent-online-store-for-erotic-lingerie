-- ============================================================
-- Self Love — Let shoppers see their own pending reviews
-- ============================================================

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reviews_user_pending_idx
  ON reviews (user_id, approved, created_at DESC);

DROP POLICY IF EXISTS "Users can read own reviews"
  ON reviews;

CREATE POLICY "Users can read own reviews"
  ON reviews FOR SELECT
  USING (auth.uid() = user_id);
