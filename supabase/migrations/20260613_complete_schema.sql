-- ============================================================
-- Velour — Complete Database Schema
-- Run the entire file in: Supabase Dashboard → SQL Editor
-- ============================================================
-- TIP: Run this ONCE on a fresh Supabase project.
-- If you already have some tables, the IF NOT EXISTS guards
-- will skip them safely.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. PROFILES
--    Auto-created for every new user via a trigger below.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  first_name  text,
  last_name   text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create a profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();


-- ════════════════════════════════════════════════════════════
-- 2. MEMBERSHIPS
--    One row per user; auto-created by handle_new_membership trigger.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS memberships (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tier         text        NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold')),
  points       integer     NOT NULL DEFAULT 0 CHECK (points >= 0),
  total_spent  numeric     NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own membership"
  ON memberships FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own membership"
  ON memberships FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-create membership row when a new auth user signs up
CREATE OR REPLACE FUNCTION handle_new_membership()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.memberships (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_membership ON auth.users;
CREATE TRIGGER on_auth_user_created_membership
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_membership();


-- ════════════════════════════════════════════════════════════
-- 3. WISHLISTS
--    One row per saved product per user.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wishlists (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id      text        NOT NULL,
  product_handle  text        NOT NULL,
  product_title   text        NOT NULL,
  product_image   text,
  product_price   numeric,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own wishlist"
  ON wishlists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert into own wishlist"
  ON wishlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete from own wishlist"
  ON wishlists FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS wishlists_user_idx ON wishlists (user_id);


-- ════════════════════════════════════════════════════════════
-- 4. REVIEWS
--    Submitted by authenticated users, approved by admin.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reviews (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        text        NOT NULL,
  product_handle    text        NOT NULL,
  rating            integer     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body              text        NOT NULL CHECK (char_length(body) >= 10),
  nickname          text        NOT NULL,
  email             text        NOT NULL,
  verified_purchase boolean     NOT NULL DEFAULT false,
  approved          boolean     NOT NULL DEFAULT false,
  photo_urls        text[]      NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved reviews
CREATE POLICY "Anyone can read approved reviews"
  ON reviews FOR SELECT
  USING (approved = true);

-- Authenticated users can insert reviews
CREATE POLICY "Authenticated users can submit reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Only service role can approve (update) reviews
CREATE POLICY "Service role can approve reviews"
  ON reviews FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS reviews_product_idx  ON reviews (product_id);
CREATE INDEX IF NOT EXISTS reviews_approved_idx ON reviews (approved, product_id);


-- ════════════════════════════════════════════════════════════
-- 5. RESTOCK ALERTS
--    Email list for out-of-stock size/colour notifications.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS restock_alerts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text        NOT NULL,
  product_id      text        NOT NULL,
  product_handle  text        NOT NULL,
  size            text        NOT NULL,
  color           text        NOT NULL,
  notified        boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, product_id, size, color)
);

ALTER TABLE restock_alerts ENABLE ROW LEVEL SECURITY;

-- Only service role reads/writes (API uses service role key)
CREATE POLICY "Service role manages restock alerts"
  ON restock_alerts FOR ALL
  USING (auth.role() = 'service_role');

-- Anyone can insert their own alert (anon users too)
CREATE POLICY "Anyone can subscribe to restock alert"
  ON restock_alerts FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS restock_product_idx ON restock_alerts (product_id, size, color, notified);


-- ════════════════════════════════════════════════════════════
-- 6. CART SNAPSHOTS
--    Stores cart state for abandoned-cart emails AND
--    cross-device cart restore.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS cart_snapshots (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email          text        NOT NULL,
  items          jsonb       NOT NULL DEFAULT '[]',
  reminder_sent  boolean     NOT NULL DEFAULT false,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cart_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cart snapshot"
  ON cart_snapshots FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS cart_snapshots_updated_idx ON cart_snapshots (updated_at)
  WHERE reminder_sent = false;


-- ════════════════════════════════════════════════════════════
-- 7. ADDRESSES
--    Saved shipping addresses per user.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS addresses (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name      text        NOT NULL,
  phone          text,
  address_line1  text        NOT NULL,
  address_line2  text,
  city           text        NOT NULL,
  state          text        NOT NULL,
  zip            text        NOT NULL,
  country        text        NOT NULL DEFAULT 'US',
  is_default     boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own addresses"
  ON addresses FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS addresses_user_idx ON addresses (user_id);


-- ════════════════════════════════════════════════════════════
-- 8. GIFT CARDS
--    Purchased as gifts; redeemed at checkout.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS gift_cards (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text        UNIQUE NOT NULL,
  amount          numeric     NOT NULL CHECK (amount > 0),
  balance         numeric     NOT NULL CHECK (balance >= 0),
  recipient_email text        NOT NULL,
  recipient_name  text        NOT NULL DEFAULT '',
  message         text        NOT NULL DEFAULT '',
  sender_name     text        NOT NULL DEFAULT 'A friend',
  is_redeemed     boolean     NOT NULL DEFAULT false,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

-- Anyone can look up a gift card by code (needed for cart redemption)
CREATE POLICY "Anyone can look up a gift card by code"
  ON gift_cards FOR SELECT
  USING (true);

-- Only service role can insert / update gift cards
CREATE POLICY "Service role manages gift cards"
  ON gift_cards FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS gift_cards_code_idx ON gift_cards (code);


-- ════════════════════════════════════════════════════════════
-- 9. REFERRALS
--    One row per user; tracks referral code + usage.
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS referrals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code            text        UNIQUE NOT NULL,
  uses            integer     NOT NULL DEFAULT 0 CHECK (uses >= 0),
  rewards_earned  numeric     NOT NULL DEFAULT 0 CHECK (rewards_earned >= 0),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Users can read and insert their own referral row
CREATE POLICY "Users can read own referral"
  ON referrals FOR SELECT
  USING (auth.uid() = referrer_id);

CREATE POLICY "Users can create own referral"
  ON referrals FOR INSERT
  WITH CHECK (auth.uid() = referrer_id);

-- Service role can look up any code (for validation during signup)
-- and can update uses / rewards_earned
CREATE POLICY "Service role manages referrals"
  ON referrals FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS referrals_code_idx     ON referrals (code);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_id);


-- ════════════════════════════════════════════════════════════
-- 10. STORAGE BUCKET — UGC (review photos)
-- ════════════════════════════════════════════════════════════
-- Option A (recommended): Supabase Dashboard → Storage → New Bucket
--   Name:   ugc
--   Public: ON  ← important so photo URLs work without tokens
--
-- Option B: SQL (only works if your project has the storage schema)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ugc', 'ugc', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to the ugc bucket
CREATE POLICY "Authenticated users can upload review photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ugc'
    AND auth.role() = 'authenticated'
  );

-- Anyone can read/view ugc photos (bucket is public)
CREATE POLICY "Anyone can view ugc photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ugc');
