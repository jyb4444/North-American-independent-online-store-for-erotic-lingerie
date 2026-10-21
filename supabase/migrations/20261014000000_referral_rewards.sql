-- ============================================================
-- Referral rewards as Shopify discount codes (D40)
--
--  * The new account gets a "welcome" code once its email is confirmed and it redeemed a
--    referral code (auth callback → redeem_referral()).
--  * The referrer gets a "referrer" code once that new account's first order is paid
--    (Shopify orders webhook → claim_referrer_reward()).
-- Codes are created through the Shopify Admin API (discountCodeBasicCreate) by the server.
-- ============================================================

CREATE TABLE IF NOT EXISTS referral_rewards (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- who can use the code
  referred_user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- the new account behind it
  kind                text        NOT NULL CHECK (kind IN ('welcome', 'referrer')),
  code                text        NOT NULL UNIQUE,
  amount              numeric     NOT NULL CHECK (amount > 0),
  minimum_subtotal    numeric     NOT NULL DEFAULT 0 CHECK (minimum_subtotal >= 0),
  status              text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'issued', 'failed')),
  shopify_discount_id text,
  error               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  -- One welcome code and one referrer code per referred account, however often the
  -- callback or webhook is replayed.
  UNIQUE (referred_user_id, kind)
);

CREATE INDEX IF NOT EXISTS referral_rewards_user_idx ON referral_rewards (user_id, created_at DESC);

DROP TRIGGER IF EXISTS referral_rewards_updated_at ON referral_rewards;
CREATE TRIGGER referral_rewards_updated_at
  BEFORE UPDATE ON referral_rewards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON referral_rewards FROM anon, authenticated;

DROP POLICY IF EXISTS "Users can read own referral rewards" ON referral_rewards;
CREATE POLICY "Users can read own referral rewards"
  ON referral_rewards FOR SELECT
  USING (auth.uid() = user_id);

-- The referrer is rewarded once per referred account.
ALTER TABLE referral_redemptions
  ADD COLUMN IF NOT EXISTS referrer_rewarded_at timestamptz;

-- Atomically marks the referrer reward for `p_referred_user_id` as claimed and adds it to the
-- referral's totals. Returns the referrer's user id, or NULL if there is nothing to claim
-- (no redemption, or already claimed).
CREATE OR REPLACE FUNCTION public.claim_referrer_reward(p_referred_user_id uuid, p_amount numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_referral_id uuid;
  v_referrer_id uuid;
BEGIN
  UPDATE public.referral_redemptions
     SET referrer_rewarded_at = now()
   WHERE referred_user_id = p_referred_user_id
     AND referrer_rewarded_at IS NULL
  RETURNING referral_id INTO v_referral_id;

  IF v_referral_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.referrals
     SET rewards_earned = rewards_earned + p_amount
   WHERE id = v_referral_id
  RETURNING referrer_id INTO v_referrer_id;

  RETURN v_referrer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referrer_reward(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referrer_reward(uuid, numeric) TO service_role;
