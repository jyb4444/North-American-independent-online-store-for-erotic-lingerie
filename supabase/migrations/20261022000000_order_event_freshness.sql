-- Keep Shopify order state monotonic when webhook deliveries arrive out of order.
-- This is intentionally incremental because some environments may have already recorded
-- 20261021000300 before the freshness guard was originally added to that file.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shopify_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.upsert_shopify_order_if_fresh(
  p_user_id uuid, p_shopify_order_id text, p_shopify_order_number text,
  p_email text, p_phone text, p_financial_status text, p_fulfillment_status text,
  p_total_amount numeric, p_currency text, p_processed_at timestamptz,
  p_shopify_updated_at timestamptz
)
RETURNS TABLE(order_id uuid, applied boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.orders AS existing (
    user_id, shopify_order_id, shopify_order_number, email, phone, financial_status,
    fulfillment_status, total_amount, currency, processed_at, shopify_updated_at
  ) VALUES (
    p_user_id, p_shopify_order_id, p_shopify_order_number, p_email, p_phone, p_financial_status,
    p_fulfillment_status, p_total_amount, p_currency, p_processed_at, p_shopify_updated_at
  )
  ON CONFLICT (shopify_order_id) DO UPDATE SET
    user_id = excluded.user_id,
    shopify_order_number = excluded.shopify_order_number,
    email = excluded.email,
    phone = excluded.phone,
    financial_status = excluded.financial_status,
    fulfillment_status = excluded.fulfillment_status,
    total_amount = excluded.total_amount,
    currency = excluded.currency,
    processed_at = excluded.processed_at,
    shopify_updated_at = excluded.shopify_updated_at
  WHERE existing.shopify_updated_at IS NULL
     OR excluded.shopify_updated_at >= existing.shopify_updated_at
  RETURNING existing.id, true;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT o.id, false
    FROM public.orders AS o
    WHERE o.shopify_order_id = p_shopify_order_id;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.upsert_shopify_order_if_fresh(
  uuid, text, text, text, text, text, text, numeric, text, timestamptz, timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_shopify_order_if_fresh(
  uuid, text, text, text, text, text, text, numeric, text, timestamptz, timestamptz
) TO service_role;

COMMENT ON FUNCTION public.upsert_shopify_order_if_fresh(
  uuid, text, text, text, text, text, text, numeric, text, timestamptz, timestamptz
) IS 'Upserts Shopify order state only when the incoming event is at least as recent as stored state.';
