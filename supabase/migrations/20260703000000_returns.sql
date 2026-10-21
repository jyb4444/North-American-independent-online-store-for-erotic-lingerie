-- ============================================================
-- Velour — Return/RMA requests
-- ============================================================

CREATE TABLE IF NOT EXISTS order_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shopify_line_item_id  text NOT NULL,
  shopify_variant_id    text,
  title                text NOT NULL,
  variant_title        text,
  sku                  text,
  quantity             integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price                numeric,
  product_type         text,
  vendor               text,
  return_category      text NOT NULL DEFAULT 'general',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, shopify_line_item_id)
);

CREATE TABLE IF NOT EXISTS return_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id              uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  request_number        text UNIQUE NOT NULL,
  desired_resolution    text NOT NULL CHECK (desired_resolution IN ('cancel_order', 'refund', 'return_refund', 'exchange', 'reship', 'partial_refund')),
  reason                text NOT NULL CHECK (reason IN ('quality_issue', 'wrong_item', 'missing_item', 'damaged_in_transit', 'not_as_expected', 'changed_mind', 'size_fit', 'privacy_packaging', 'other')),
  status                text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'needs_more_info', 'approved', 'rejected', 'awaiting_customer_shipment', 'customer_shipped', 'received', 'inspected', 'refund_pending', 'refunded', 'exchange_pending', 'exchanged', 'reship_pending', 'reshipped', 'closed')),
  eligibility_status    text NOT NULL DEFAULT 'review_required' CHECK (eligibility_status IN ('eligible', 'ineligible', 'review_required')),
  policy_notes          text[] NOT NULL DEFAULT '{}',
  customer_note         text,
  media_urls            text[] NOT NULL DEFAULT '{}',
  return_shipping_method text,
  return_carrier        text,
  return_tracking_number text,
  return_tracking_url   text,
  inspected_at          timestamptz,
  shopify_sync_status   text NOT NULL DEFAULT 'pending' CHECK (shopify_sync_status IN ('pending', 'synced', 'failed', 'skipped')),
  shopify_sync_error    text,
  shopify_synced_at     timestamptz,
  admin_notes           text,
  submitted_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS return_request_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_request_id  uuid NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
  order_item_id      uuid NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  quantity           integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  item_condition     text NOT NULL CHECK (item_condition IN ('unopened_tags_attached', 'opened_unused', 'used', 'damaged', 'defective')),
  reason_detail      text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (return_request_id, order_item_id)
);

CREATE TABLE IF NOT EXISTS return_request_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_request_id  uuid NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
  event_type         text NOT NULL,
  title              text NOT NULL,
  description        text,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_request_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own order items" ON order_items;
CREATE POLICY "Users can read own order items"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages order items" ON order_items;
CREATE POLICY "Service role manages order items"
  ON order_items FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can read own return requests" ON return_requests;
CREATE POLICY "Users can read own return requests"
  ON return_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages return requests" ON return_requests;
CREATE POLICY "Service role manages return requests"
  ON return_requests FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can read own return request items" ON return_request_items;
CREATE POLICY "Users can read own return request items"
  ON return_request_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM return_requests
      WHERE return_requests.id = return_request_items.return_request_id
      AND return_requests.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages return request items" ON return_request_items;
CREATE POLICY "Service role manages return request items"
  ON return_request_items FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can read own return request events" ON return_request_events;
CREATE POLICY "Users can read own return request events"
  ON return_request_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM return_requests
      WHERE return_requests.id = return_request_events.return_request_id
      AND return_requests.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role manages return request events" ON return_request_events;
CREATE POLICY "Service role manages return request events"
  ON return_request_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
CREATE INDEX IF NOT EXISTS return_requests_user_idx ON return_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS return_requests_order_idx ON return_requests (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS return_request_items_request_idx ON return_request_items (return_request_id);
CREATE INDEX IF NOT EXISTS return_request_events_request_idx ON return_request_events (return_request_id, created_at DESC);

DROP TRIGGER IF EXISTS order_items_updated_at ON order_items;
CREATE TRIGGER order_items_updated_at
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS return_requests_updated_at ON return_requests;
CREATE TRIGGER return_requests_updated_at
  BEFORE UPDATE ON return_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('returns', 'returns', false)
ON CONFLICT (id) DO UPDATE
SET public = false;

DROP POLICY IF EXISTS "Users can upload own return media"
  ON storage.objects;

CREATE POLICY "Users can upload own return media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'returns'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can read own return media"
  ON storage.objects;

CREATE POLICY "Users can read own return media"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'returns'
    AND (
      auth.role() = 'service_role'
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );
