BEGIN;
-- Forward-only repair of catalog drift; intentionally leaves five auth FK delete actions unchanged.
-- Checks happen before DDL. No row is updated/deleted, including the eight approved reviews.
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE failures text[] := '{}';
BEGIN
 IF EXISTS (SELECT 1 FROM public.reviews WHERE char_length(body)<10) THEN failures:=array_append(failures,'reviews: body shorter than 10'); END IF;
 IF EXISTS (SELECT 1 FROM public.referrals WHERE referrer_id IS NULL OR uses IS NULL OR uses<0 OR rewards_earned IS NULL OR rewards_earned<0 OR created_at IS NULL) THEN failures:=array_append(failures,'referrals: null or negative values'); END IF;
 IF EXISTS (SELECT 1 FROM public.referrals GROUP BY referrer_id HAVING count(*)>1) THEN failures:=array_append(failures,'referrals: duplicate referrer_id'); END IF;
 IF EXISTS (SELECT 1 FROM public.memberships WHERE points<0) THEN failures:=array_append(failures,'memberships: negative points'); END IF;
 IF EXISTS (SELECT 1 FROM public.restock_alerts GROUP BY email,product_id,size,color HAVING count(*)>1) THEN failures:=array_append(failures,'restock_alerts: duplicate subscription'); END IF;
 IF EXISTS (SELECT 1 FROM public.gift_cards WHERE amount<=0 OR balance<0 OR recipient_name IS NULL OR message IS NULL OR sender_name IS NULL OR is_redeemed IS NULL OR created_at IS NULL) THEN failures:=array_append(failures,'gift_cards: null or invalid values'); END IF;
 IF cardinality(failures)>0 THEN RAISE EXCEPTION 'Reconciliation preflight failed: %',array_to_string(failures,'; '); END IF;
END $$;
ALTER TABLE public.reviews ALTER COLUMN approved SET DEFAULT false;
ALTER TABLE public.referrals
 ALTER COLUMN referrer_id SET NOT NULL,
 ALTER COLUMN uses SET NOT NULL, ALTER COLUMN uses SET DEFAULT 0,
 ALTER COLUMN rewards_earned SET NOT NULL, ALTER COLUMN rewards_earned SET DEFAULT 0,
 ALTER COLUMN created_at SET NOT NULL, ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.gift_cards
 ALTER COLUMN recipient_name SET NOT NULL, ALTER COLUMN recipient_name SET DEFAULT '',
 ALTER COLUMN message SET NOT NULL, ALTER COLUMN message SET DEFAULT '',
 ALTER COLUMN sender_name SET NOT NULL, ALTER COLUMN sender_name SET DEFAULT 'A friend',
 ALTER COLUMN is_redeemed SET NOT NULL, ALTER COLUMN is_redeemed SET DEFAULT false,
 ALTER COLUMN created_at SET NOT NULL, ALTER COLUMN created_at SET DEFAULT now();
-- Names are checked against their complete definitions: IF NOT EXISTS alone is insufficient.
DO $$
DECLARE spec record; actual text;
BEGIN
 FOR spec IN SELECT * FROM (VALUES
 ('reviews','reviews_body_check','CHECK (char_length(body) >= 10)'),
 ('referrals','referrals_referrer_id_key','UNIQUE (referrer_id)'),
 ('referrals','referrals_uses_check','CHECK (uses >= 0)'),
 ('referrals','referrals_rewards_earned_check','CHECK (rewards_earned >= 0)'),
 ('memberships','memberships_points_check','CHECK (points >= 0)'),
 ('restock_alerts','restock_alerts_email_product_id_size_color_key','UNIQUE (email, product_id, size, color)'),
 ('gift_cards','gift_cards_amount_check','CHECK (amount > 0)'),
 ('gift_cards','gift_cards_balance_check','CHECK (balance >= 0)')
 ) AS specs(tbl, cname, definition)
 LOOP
  SELECT pg_get_constraintdef(oid,true) INTO actual FROM pg_constraint WHERE conrelid=format('public.%I',spec.tbl)::regclass AND conname=spec.cname;
  IF actual IS NULL THEN EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s',spec.tbl,spec.cname,spec.definition);
  ELSIF regexp_replace(replace(replace(actual, '::numeric', ''), '''0''', '0'),'[[:space:]()]','','g')<>regexp_replace(spec.definition,'[[:space:]()]','','g') THEN
   RAISE EXCEPTION 'Unexpected constraint definition: %.%',spec.tbl,spec.cname;
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON TABLE public.referral_redemptions,public.referral_rewards FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.referral_redemptions,public.referral_rewards TO service_role;
GRANT SELECT ON TABLE public.referral_rewards TO authenticated;
-- Remove redundant legacy write policies too; grants remain the primary write boundary.
DROP POLICY IF EXISTS "Authenticated users write reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users insert own membership" ON public.memberships;
DROP POLICY IF EXISTS "Users update own membership" ON public.memberships;

COMMIT;
