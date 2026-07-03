-- ============================================================
-- Velour — Orders and private shipment tracking
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS orders (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  shopify_order_id     text UNIQUE NOT NULL,
  shopify_order_number text NOT NULL,
  email                text NOT NULL,
  phone                text,
  financial_status     text,
  fulfillment_status   text,
  total_amount         numeric,
  currency             text NOT NULL DEFAULT 'USD',
  processed_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  shopify_fulfillment_id text UNIQUE,
  tracking_number       text,
  tracking_url          text,
  carrier               text,
  status                text NOT NULL DEFAULT 'preparing',
  estimated_delivery_at timestamptz,
  shipped_at            timestamptz,
  delivered_at          timestamptz,
  public_lookup_token   text UNIQUE NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipment_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status      text NOT NULL,
  title       text NOT NULL,
  description text,
  location    text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            uuid REFERENCES orders(id) ON DELETE SET NULL,
  shipment_id         uuid REFERENCES shipments(id) ON DELETE SET NULL,
  channel             text NOT NULL CHECK (channel IN ('email', 'sms')),
  event_type          text NOT NULL,
  recipient           text NOT NULL,
  provider_message_id text,
  sent_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages orders"
  ON orders FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own shipments"
  ON shipments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = shipments.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages shipments"
  ON shipments FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can read own shipment events"
  ON shipment_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM shipments
      JOIN orders ON orders.id = shipments.order_id
      WHERE shipments.id = shipment_events.shipment_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages shipment events"
  ON shipment_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages notification logs"
  ON notification_logs FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_email_idx ON orders (lower(email), shopify_order_number);
CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders (phone, shopify_order_number);
CREATE INDEX IF NOT EXISTS shipments_order_idx ON shipments (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shipments_token_idx ON shipments (public_lookup_token);
CREATE INDEX IF NOT EXISTS shipment_events_shipment_idx ON shipment_events (shipment_id, occurred_at DESC);

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS shipments_updated_at ON shipments;
CREATE TRIGGER shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
