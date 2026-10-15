-- ============================================================

BEGIN;
SET LOCAL lock_timeout = '5s';
-- Security hardening — see docs/testing/TEST_PLAN.md §0
-- Verified by tests/api/security.spec.ts (SEC-01 … SEC-08).
-- ============================================================

-- ─── D01 gift cards ──────────────────────────────────────────
-- Gift cards were readable by anyone (USING (true)), exposing every code, balance
-- and recipient email to the public anon key. Lookups now go through
-- GET /api/gift-card, which uses the service role and is rate limited.
DROP POLICY IF EXISTS "Anyone can look up a gift card by code" ON gift_cards;

-- ─── D02 memberships ─────────────────────────────────────────
-- Tier, points and spend are server-managed. Users keep read access to their own row.
DROP POLICY IF EXISTS "Users can update own membership" ON memberships;
REVOKE INSERT, UPDATE, DELETE ON memberships FROM anon, authenticated;

-- ─── D03 / D33 reviews ───────────────────────────────────────
-- Reviews are inserted only by POST /api/reviews (service role) after validation, so
-- users can no longer self-approve, mark a review verified, or impersonate others.
DROP POLICY IF EXISTS "Authenticated users can submit reviews" ON reviews;
REVOKE INSERT, UPDATE, DELETE ON reviews FROM anon, authenticated;

-- Approved reviews are public, but only their public columns. `email` holds the
-- reviewer's private contact (email or phone) and `user_id` links reviews to accounts.
REVOKE SELECT ON reviews FROM anon, authenticated;
GRANT SELECT (
  id, product_id, product_handle, rating, body, nickname,
  verified_purchase, approved, photo_urls, video_urls, is_anonymous, created_at
) ON reviews TO anon, authenticated;

-- ─── D07 profiles / order ownership ──────────────────────────
-- Users may edit their display fields only. `email` must keep mirroring auth.users,
-- because it was used to attach Shopify orders to accounts.
REVOKE UPDATE ON profiles FROM anon, authenticated;
GRANT UPDATE (first_name, last_name, avatar_url, updated_at) ON profiles TO authenticated;

-- Orders are attached to the account whose *confirmed* auth email matches exactly
-- (case-insensitive, no pattern matching). Service role only.
CREATE OR REPLACE FUNCTION public.confirmed_user_id_for_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
    AND email_confirmed_at IS NOT NULL
  ORDER BY created_at
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.confirmed_user_id_for_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmed_user_id_for_email(text) TO service_role;

-- ─── D08 referrals ───────────────────────────────────────────
-- Referral codes are created by GET /api/referral (service role). Users can no
-- longer insert rows with arbitrary `uses` / `rewards_earned`.
DROP POLICY IF EXISTS "Users can create own referral" ON referrals;
REVOKE INSERT, UPDATE, DELETE ON referrals FROM anon, authenticated;

-- Each new account can redeem one referral, once, and never its own code.
CREATE TABLE IF NOT EXISTS referral_redemptions (
  referred_user_id uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_id      uuid        NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE referral_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON referral_redemptions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON referral_redemptions TO service_role;
-- No policies: service role only.

CREATE OR REPLACE FUNCTION public.redeem_referral(p_code text, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_referral_id uuid;
  v_referrer_id uuid;
  v_inserted    integer;
BEGIN
  SELECT id, referrer_id
    INTO v_referral_id, v_referrer_id
    FROM public.referrals
   WHERE code = upper(trim(p_code));

  IF v_referral_id IS NULL OR v_referrer_id = p_user_id THEN
    RETURN false;
  END IF;

  INSERT INTO public.referral_redemptions (referred_user_id, referral_id)
  VALUES (p_user_id, v_referral_id)
  ON CONFLICT (referred_user_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN false;
  END IF;

  UPDATE public.referrals SET uses = uses + 1 WHERE id = v_referral_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_referral(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_referral(text, uuid) TO service_role;

COMMIT;
