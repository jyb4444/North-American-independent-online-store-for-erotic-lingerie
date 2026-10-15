BEGIN;
-- Durable, service-only work queues. No HTTP requests occur inside these transactions.
SET LOCAL lock_timeout = '5s';
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.referral_rewards WHERE kind='referrer') THEN RAISE EXCEPTION 'Existing referrer rewards require canonical payment evidence before migration'; END IF;
 IF EXISTS (SELECT 1 FROM public.referral_rewards r WHERE NOT EXISTS(SELECT 1 FROM public.referral_redemptions d WHERE d.referred_user_id=r.referred_user_id) OR (r.kind='welcome' AND r.user_id<>r.referred_user_id)) THEN RAISE EXCEPTION 'Orphan or mismatched referral reward requires manual reconciliation'; END IF;
 IF EXISTS (SELECT 1 FROM public.referral_rewards WHERE status='issued') THEN
  RAISE EXCEPTION 'Existing issued discounts require customer-eligibility reconciliation before delivery migration';
 END IF;
 IF EXISTS (SELECT 1 FROM public.referral_redemptions d WHERE referrer_rewarded_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.referral_rewards r WHERE r.referred_user_id=d.referred_user_id AND r.kind='referrer')) THEN
  RAISE EXCEPTION 'Claimed redemption without reward requires manual reconciliation';
 END IF;
END $$;
ALTER TABLE public.referral_rewards DROP CONSTRAINT referral_rewards_status_check;
ALTER TABLE public.referral_rewards ADD CONSTRAINT referral_rewards_status_check CHECK(status IN ('pending','processing','issued','failed','manual_review'));
ALTER TABLE public.referral_rewards
 ADD COLUMN recipient_email text,
 ADD COLUMN shopify_customer_id text,
 ADD COLUMN qualifying_order_id text,
 ADD COLUMN qualifying_customer_id text,
 ADD COLUMN qualifying_paid_at timestamptz,
 ADD COLUMN attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN last_error text,
 ADD COLUMN lease_token uuid,
 ADD COLUMN lease_until timestamptz,
 ADD COLUMN email_status text NOT NULL DEFAULT 'pending' CHECK(email_status IN ('pending','sent','failed','manual_review')),
 ADD COLUMN email_attempts integer NOT NULL DEFAULT 0 CHECK(email_attempts>=0),
 ADD COLUMN email_provider_id text,
 ADD COLUMN email_sent_at timestamptz,
 ADD COLUMN accounted_at timestamptz;
CREATE UNIQUE INDEX referral_qualifying_order_unique ON public.referral_rewards(qualifying_order_id) WHERE kind='referrer';
CREATE INDEX referral_rewards_due_idx ON public.referral_rewards(next_attempt_at) WHERE status IN ('pending','failed','processing','issued');
CREATE TABLE public.referral_webhook_events (
 event_id text PRIMARY KEY,
 shop_domain text NOT NULL,
 body_hash text NOT NULL,
 order_id text NOT NULL,
 user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','complete','failed','manual_review')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 last_error text,
 lease_token uuid,
 lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referral_webhook_events_due_idx ON public.referral_webhook_events(next_attempt_at) WHERE status IN ('pending','failed','processing');
ALTER TABLE public.referral_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referral_webhook_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.referral_webhook_events TO service_role;

-- Shopify can deliver order topics out of order. Store its source timestamp and make the
-- winning update atomic, while the compatibility release falls back when this RPC is absent.
ALTER TABLE public.orders ADD COLUMN shopify_updated_at timestamptz;
CREATE FUNCTION public.upsert_shopify_order_if_fresh(
 p_user_id uuid,p_shopify_order_id text,p_shopify_order_number text,p_email text,p_phone text,
 p_financial_status text,p_fulfillment_status text,p_total_amount numeric,p_currency text,
 p_processed_at timestamptz,p_shopify_updated_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid;
BEGIN
 IF p_shopify_updated_at IS NULL OR p_shopify_updated_at>now()+interval '5 minutes' THEN
  RAISE EXCEPTION 'Invalid Shopify order update timestamp';
 END IF;
 INSERT INTO public.orders(user_id,shopify_order_id,shopify_order_number,email,phone,financial_status,fulfillment_status,total_amount,currency,processed_at,shopify_updated_at)
 VALUES(p_user_id,p_shopify_order_id,p_shopify_order_number,p_email,p_phone,p_financial_status,p_fulfillment_status,p_total_amount,p_currency,p_processed_at,p_shopify_updated_at)
 ON CONFLICT(shopify_order_id) DO UPDATE SET
  user_id=excluded.user_id,shopify_order_number=excluded.shopify_order_number,email=excluded.email,
  phone=excluded.phone,financial_status=excluded.financial_status,fulfillment_status=excluded.fulfillment_status,
  total_amount=excluded.total_amount,currency=excluded.currency,processed_at=excluded.processed_at,
  shopify_updated_at=excluded.shopify_updated_at
 WHERE public.orders.shopify_updated_at IS NULL OR public.orders.shopify_updated_at<excluded.shopify_updated_at
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;
-- Retire the non-atomic claim entry point, including its service role permission.
REVOKE ALL ON FUNCTION public.claim_referrer_reward(uuid,numeric) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.queue_referral_welcome(p_user_id uuid,p_amount numeric,p_minimum numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id uuid; v_email text;
BEGIN
 IF p_amount<=0 OR p_minimum<0 THEN RAISE EXCEPTION 'Invalid reward settings'; END IF;
 PERFORM 1 FROM public.referral_redemptions WHERE referred_user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT email INTO v_email FROM auth.users WHERE id=p_user_id AND email_confirmed_at IS NOT NULL;
 IF v_email IS NULL THEN RETURN NULL; END IF;
 INSERT INTO public.referral_rewards(user_id,referred_user_id,kind,code,amount,minimum_subtotal,recipient_email)
 VALUES(p_user_id,p_user_id,'welcome','SLWELCOME-'||upper(replace(gen_random_uuid()::text,'-','')),p_amount,p_minimum,v_email)
 ON CONFLICT(referred_user_id,kind) DO NOTHING;
 SELECT id INTO v_id FROM public.referral_rewards WHERE referred_user_id=p_user_id AND kind='welcome';
 RETURN v_id;
END $$;

CREATE FUNCTION public.claim_referral_paid_order(p_user_id uuid,p_order_id text,p_paid_at timestamptz,p_customer_id text,p_amount numeric,p_minimum numeric)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.referral_redemptions; v_referrer uuid; v_email text; v_id uuid;
BEGIN
 IF p_order_id NOT LIKE 'gid://shopify/Order/%' OR p_customer_id NOT LIKE 'gid://shopify/Customer/%' OR p_paid_at IS NULL OR p_paid_at>now() OR p_amount<=0 OR p_minimum<0 THEN RAISE EXCEPTION 'Invalid verified payment evidence'; END IF;
 SELECT * INTO d FROM public.referral_redemptions WHERE referred_user_id=p_user_id FOR UPDATE;
 IF NOT FOUND THEN RETURN 'pending_redemption'; END IF;
 SELECT id INTO v_id FROM public.referral_rewards WHERE referred_user_id=p_user_id AND kind='referrer';
 IF v_id IS NOT NULL THEN RETURN 'already_claimed'; END IF;
 IF d.referrer_rewarded_at IS NOT NULL THEN RAISE EXCEPTION 'Claimed redemption without reward'; END IF;
 IF d.created_at>p_paid_at OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id AND email_confirmed_at IS NOT NULL AND created_at<=p_paid_at) THEN RETURN 'manual_review'; END IF;
 SELECT referrer_id INTO v_referrer FROM public.referrals WHERE id=d.referral_id;
 SELECT email INTO v_email FROM auth.users WHERE id=v_referrer;
 IF v_referrer IS NULL OR v_referrer=p_user_id THEN RETURN 'manual_review'; END IF;
 INSERT INTO public.referral_rewards(user_id,referred_user_id,kind,code,amount,minimum_subtotal,recipient_email,qualifying_order_id,qualifying_customer_id,qualifying_paid_at)
 VALUES(v_referrer,p_user_id,'referrer','SLTHANKS-'||upper(replace(gen_random_uuid()::text,'-','')),p_amount,p_minimum,v_email,p_order_id,p_customer_id,p_paid_at)
 RETURNING id INTO v_id;
 UPDATE public.referral_redemptions SET referrer_rewarded_at=now() WHERE referred_user_id=p_user_id;
 RETURN 'claimed';
END $$;

CREATE FUNCTION public.lease_referral_rewards(p_limit integer DEFAULT 10)
RETURNS SETOF public.referral_rewards LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.referral_rewards SET status='manual_review',last_error='Retry budget exhausted after worker crash; manual retry required',lease_token=NULL,lease_until=NULL WHERE status='processing' AND attempts>=8 AND lease_until<now();
 UPDATE public.referral_rewards SET email_status='manual_review',last_error='Email retry budget exhausted after worker crash',lease_token=NULL,lease_until=NULL WHERE status='issued' AND email_attempts>=8 AND lease_until<now() AND email_status<>'sent';
 RETURN QUERY WITH due AS (
 SELECT id FROM public.referral_rewards
 WHERE next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now())
 AND ((status IN ('pending','failed','processing') AND attempts<8) OR (status='issued' AND email_status IN ('pending','failed') AND email_attempts<8))
 ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT greatest(0,least(p_limit,10))
 ) UPDATE public.referral_rewards r SET lease_token=gen_random_uuid(),lease_until=now()+interval '10 minutes',
 attempts=r.attempts+CASE WHEN r.status='issued' THEN 0 ELSE 1 END,
 email_attempts=r.email_attempts+CASE WHEN r.status='issued' THEN 1 ELSE 0 END,
 status=CASE WHEN r.status='issued' THEN 'issued' ELSE 'processing' END
 FROM due WHERE r.id=due.id RETURNING r.*;
END $$;
CREATE FUNCTION public.lease_referral_events(p_limit integer DEFAULT 10)
RETURNS SETOF public.referral_webhook_events LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.referral_webhook_events SET status='manual_review',last_error='Event retry budget exhausted after worker crash',lease_token=NULL,lease_until=NULL WHERE status='processing' AND attempts>=8 AND lease_until<now();
 RETURN QUERY WITH due AS (
 SELECT event_id FROM public.referral_webhook_events WHERE status IN ('pending','failed','processing') AND attempts<8 AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now())
 ORDER BY next_attempt_at,event_id FOR UPDATE SKIP LOCKED LIMIT greatest(0,least(p_limit,10))
 ) UPDATE public.referral_webhook_events e SET status='processing',attempts=e.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '10 minutes'
 FROM due WHERE e.event_id=due.event_id RETURNING e.*;
END $$;
-- Discount completion and accounting are atomic; email delivery remains independent.
CREATE FUNCTION public.finish_referral_discount(p_id uuid,p_lease uuid,p_discount_id text,p_customer_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.referral_rewards;
BEGIN
 SELECT * INTO r FROM public.referral_rewards WHERE id=p_id AND lease_token=p_lease AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF r.recipient_email IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=r.user_id AND email_confirmed_at IS NOT NULL AND lower(email)=lower(r.recipient_email)) THEN RETURN false; END IF;
 IF p_discount_id NOT LIKE 'gid://shopify/DiscountCodeNode/%' OR p_customer_id NOT LIKE 'gid://shopify/Customer/%' THEN RAISE EXCEPTION 'Invalid discount identity'; END IF;
 IF r.kind='referrer' AND NOT EXISTS(SELECT 1 FROM public.referral_redemptions d JOIN public.referrals f ON f.id=d.referral_id WHERE d.referred_user_id=r.referred_user_id AND d.referrer_rewarded_at IS NOT NULL AND f.referrer_id=r.user_id) THEN RETURN false; END IF;
 IF r.kind='referrer' AND r.accounted_at IS NULL THEN
  UPDATE public.referrals SET rewards_earned=rewards_earned+r.amount WHERE id=(SELECT referral_id FROM public.referral_redemptions WHERE referred_user_id=r.referred_user_id);
 END IF;
 UPDATE public.referral_rewards SET status='issued',shopify_discount_id=p_discount_id,shopify_customer_id=p_customer_id,
 accounted_at=coalesce(accounted_at,now()),last_error=NULL,error=NULL,lease_token=NULL,lease_until=NULL,next_attempt_at=now() WHERE id=p_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.queue_referral_welcome(uuid,numeric,numeric),public.claim_referral_paid_order(uuid,text,timestamptz,text,numeric,numeric),public.lease_referral_rewards(integer),public.lease_referral_events(integer),public.finish_referral_discount(uuid,uuid,text,text),public.upsert_shopify_order_if_fresh(uuid,text,text,text,text,text,text,numeric,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_referral_welcome(uuid,numeric,numeric),public.claim_referral_paid_order(uuid,text,timestamptz,text,numeric,numeric),public.lease_referral_rewards(integer),public.lease_referral_events(integer),public.finish_referral_discount(uuid,uuid,text,text),public.upsert_shopify_order_if_fresh(uuid,text,text,text,text,text,text,numeric,text,timestamptz,timestamptz) TO service_role;

COMMIT;
