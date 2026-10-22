-- Canonical Shopify line item identities and a durable inbox for out-of-order fulfillment webhooks.
SET lock_timeout = '5s';
SET statement_timeout = '60s';
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.order_items
     GROUP BY order_id, regexp_replace(shopify_line_item_id, '^gid://shopify/LineItem/', '')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'preflight failed: canonical Shopify line item IDs would conflict';
  END IF;
END $$;

UPDATE public.order_items
   SET shopify_line_item_id = regexp_replace(shopify_line_item_id, '^gid://shopify/LineItem/', '')
 WHERE shopify_line_item_id LIKE 'gid://shopify/LineItem/%';

UPDATE public.order_items
   SET shopify_variant_id = regexp_replace(shopify_variant_id, '^gid://shopify/ProductVariant/', '')
 WHERE shopify_variant_id LIKE 'gid://shopify/ProductVariant/%';

CREATE TABLE public.shopify_webhook_inbox (
  event_id text PRIMARY KEY,
  topic text NOT NULL,
  shop_domain text NOT NULL,
  body_hash text NOT NULL,
  shopify_order_id text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','complete','failed','manual_review')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.shopify_webhook_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopify_webhook_inbox FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopify_webhook_inbox TO service_role;

CREATE INDEX shopify_webhook_inbox_pending_idx
  ON public.shopify_webhook_inbox (next_attempt_at, created_at)
  WHERE status IN ('pending','failed');

CREATE INDEX shopify_webhook_inbox_order_idx
  ON public.shopify_webhook_inbox (shopify_order_id)
  WHERE status IN ('pending','failed');

CREATE OR REPLACE FUNCTION public.lease_shopify_webhook_events(
  p_limit integer DEFAULT 25,
  p_order_id text DEFAULT NULL
)
RETURNS SETOF public.shopify_webhook_inbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT event_id FROM public.shopify_webhook_inbox
     WHERE status IN ('pending','failed','processing')
       AND attempts < 8
       AND (p_order_id IS NOT NULL OR next_attempt_at <= now())
       AND (p_order_id IS NULL OR shopify_order_id = p_order_id)
       AND (lease_until IS NULL OR lease_until < now())
     ORDER BY created_at
     FOR UPDATE SKIP LOCKED
     LIMIT greatest(1, least(p_limit, 100))
  )
  UPDATE public.shopify_webhook_inbox inbox
     SET status = 'processing', attempts = inbox.attempts + 1, lease_token = gen_random_uuid(),
         lease_until = now() + interval '5 minutes'
    FROM due WHERE inbox.event_id = due.event_id
  RETURNING inbox.*;
END;
$$;

REVOKE ALL ON FUNCTION public.lease_shopify_webhook_events(integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lease_shopify_webhook_events(integer, text) TO service_role;

ALTER TABLE public.notification_jobs DROP CONSTRAINT IF EXISTS notification_jobs_kind_check;
ALTER TABLE public.notification_jobs ADD CONSTRAINT notification_jobs_kind_check CHECK (
  kind IN ('return_customer','return_merchant','return_status','newsletter_confirmation','newsletter_welcome','restock','shipment_created')
);

CREATE TABLE public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Deliberately not an FK: the audit request must survive deletion from auth.users.
  user_id uuid NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','processing','completed','cancelled')),
  reason text,
  processed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  retention_until timestamptz,
  completed_at timestamptz,
  CONSTRAINT account_deletion_reason_length CHECK (reason IS NULL OR char_length(reason) <= 1000)
);

CREATE UNIQUE INDEX account_deletion_one_active_per_user
  ON public.account_deletion_requests(user_id)
  WHERE status IN ('requested','processing');

CREATE TABLE public.operations_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_requests, public.operations_audit_log FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_deletion_requests, public.operations_audit_log TO service_role;
CREATE INDEX operations_audit_log_created_idx ON public.operations_audit_log (created_at DESC);

CREATE OR REPLACE FUNCTION public.update_account_deletion_request_admin(
  p_request_id uuid,
  p_status text,
  p_reason text,
  p_admin_user_id uuid
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request public.account_deletion_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_request FROM public.account_deletion_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deletion request not found'; END IF;
  IF NOT ((v_request.status='requested' AND p_status IN ('processing','cancelled')) OR
          (v_request.status='processing' AND p_status IN ('completed','cancelled'))) THEN
    RAISE EXCEPTION 'Invalid deletion request transition';
  END IF;
  UPDATE public.account_deletion_requests SET status=p_status,
    reason=nullif(left(trim(coalesce(p_reason,'')),1000),''), processed_by=p_admin_user_id,
    updated_at=now(), completed_at=CASE WHEN p_status='completed' THEN now() ELSE NULL END,
    retention_until=CASE WHEN p_status='completed' THEN now()+interval '7 years' ELSE NULL END
  WHERE id=p_request_id;
  INSERT INTO public.operations_audit_log(admin_user_id,action,target_type,target_id,metadata)
  VALUES(p_admin_user_id,'account_deletion_status_updated','account_deletion_request',p_request_id::text,
    jsonb_build_object('from',v_request.status,'to',p_status));
END $$;

REVOKE ALL ON FUNCTION public.update_account_deletion_request_admin(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_account_deletion_request_admin(uuid,text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.retry_notification_job_admin(
  p_job_id uuid,
  p_admin_user_id uuid
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.notification_jobs
     SET status='failed', attempts=0, next_attempt_at=now(), lease_token=NULL,
         lease_until=NULL, last_error=NULL
   WHERE id=p_job_id AND status='manual_review';
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.operations_audit_log(admin_user_id,action,target_type,target_id)
  VALUES(p_admin_user_id,'notification_retry_queued','notification_job',p_job_id::text);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.retry_notification_job_admin(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.retry_notification_job_admin(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.retry_shopify_webhook_admin(
  p_event_id text,
  p_admin_user_id uuid
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.shopify_webhook_inbox
     SET status='failed', attempts=0, next_attempt_at=now(), lease_token=NULL,
         lease_until=NULL, last_error=NULL
   WHERE event_id=p_event_id AND status='manual_review';
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.operations_audit_log(admin_user_id,action,target_type,target_id)
  VALUES(p_admin_user_id,'webhook_retry_queued','shopify_webhook',p_event_id);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.retry_shopify_webhook_admin(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.retry_shopify_webhook_admin(text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.update_return_request_admin(
  p_request_id uuid,
  p_status text,
  p_note text,
  p_admin_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.return_requests%ROWTYPE;
  v_email text;
  v_order_number text;
BEGIN
  IF p_status NOT IN ('needs_more_info','approved','rejected','awaiting_customer_shipment','received','inspected','refund_pending','refunded','closed') THEN
    RAISE EXCEPTION 'Invalid return status';
  END IF;
  SELECT * INTO v_request FROM public.return_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Return request not found'; END IF;
  IF NOT (
    (v_request.status = 'submitted' AND p_status IN ('needs_more_info','approved','rejected')) OR
    (v_request.status = 'needs_more_info' AND p_status IN ('approved','rejected')) OR
    (v_request.status = 'approved' AND p_status IN ('awaiting_customer_shipment','received','closed')) OR
    (v_request.status = 'awaiting_customer_shipment' AND p_status IN ('received','closed')) OR
    (v_request.status = 'customer_shipped' AND p_status IN ('received','closed')) OR
    (v_request.status = 'received' AND p_status IN ('inspected','closed')) OR
    (v_request.status = 'inspected' AND p_status IN ('refund_pending','rejected','closed')) OR
    (v_request.status = 'refund_pending' AND p_status IN ('refunded','closed')) OR
    (v_request.status IN ('refunded','rejected') AND p_status = 'closed')
  ) THEN
    RAISE EXCEPTION 'Invalid return transition from % to %', v_request.status, p_status;
  END IF;
  SELECT p.email, o.shopify_order_number INTO v_email, v_order_number
    FROM public.profiles p JOIN public.orders o ON o.id = v_request.order_id
   WHERE p.id = v_request.user_id;
  UPDATE public.return_requests SET status = p_status, admin_notes = nullif(left(trim(coalesce(p_note,'')),1000),'') WHERE id = p_request_id;
  INSERT INTO public.return_request_events(return_request_id,event_type,title,description,metadata)
  VALUES (p_request_id,'merchant_update','Request ' || replace(p_status,'_',' '),nullif(left(trim(coalesce(p_note,'')),1000),''),jsonb_build_object('admin_id',p_admin_user_id));
  INSERT INTO public.notification_jobs(kind,identity,payload,status,next_attempt_at)
  VALUES ('return_status','return-status:' || v_request.request_number || ':' || p_status,
    jsonb_build_object('to',v_email,'requestNumber',v_request.request_number,'orderNumber',v_order_number,'status',p_status,'note',nullif(left(trim(coalesce(p_note,'')),1000),'')),
    'pending',now())
  ON CONFLICT (identity) DO NOTHING;
  INSERT INTO public.operations_audit_log(admin_user_id,action,target_type,target_id,metadata)
  VALUES (p_admin_user_id,'return_status_updated','return_request',p_request_id::text,jsonb_build_object('from',v_request.status,'to',p_status));
END;
$$;

REVOKE ALL ON FUNCTION public.update_return_request_admin(uuid,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_return_request_admin(uuid,text,text,uuid) TO service_role;

ALTER TABLE public.cart_snapshots
  ADD COLUMN IF NOT EXISTS reminder_attempts integer NOT NULL DEFAULT 0 CHECK (reminder_attempts >= 0),
  ADD COLUMN IF NOT EXISTS reminder_last_error text;
