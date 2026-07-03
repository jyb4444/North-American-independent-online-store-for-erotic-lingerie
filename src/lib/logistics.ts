import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { sendShipmentCreatedEmail } from '@/lib/email';

export type ShipmentEvent = {
  id: string;
  status: string;
  title: string;
  description: string | null;
  location: string | null;
  occurred_at: string;
};

export type ShipmentWithEvents = {
  id: string;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier: string | null;
  status: string;
  estimated_delivery_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  public_lookup_token: string;
  created_at: string;
  updated_at: string;
  shipment_events: ShipmentEvent[];
};

export type OrderWithShipments = {
  id: string;
  shopify_order_id: string;
  shopify_order_number: string;
  email: string;
  phone: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  total_amount: number | null;
  currency: string;
  processed_at: string | null;
  created_at: string;
  shipments: ShipmentWithEvents[];
};

type ShopifyOrderPayload = {
  id?: number | string;
  admin_graphql_api_id?: string;
  name?: string;
  order_number?: number | string;
  email?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  total_price?: string | number | null;
  current_total_price?: string | number | null;
  currency?: string | null;
  currency_code?: string | null;
  processed_at?: string | null;
  fulfillments?: ShopifyFulfillmentPayload[];
};

type ShopifyFulfillmentPayload = {
  id?: number | string;
  admin_graphql_api_id?: string;
  order_id?: number | string;
  status?: string | null;
  shipment_status?: string | null;
  tracking_company?: string | null;
  tracking_number?: string | null;
  tracking_numbers?: string[] | null;
  tracking_url?: string | null;
  tracking_urls?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
  estimated_delivery_at?: string | null;
};

function normalizeId(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeOrderNumber(payload: ShopifyOrderPayload): string {
  return String(payload.name ?? payload.order_number ?? payload.id ?? '').replace(/^#/, '');
}

function normalizeAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function generateLookupToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

function getTrackingNumber(fulfillment: ShopifyFulfillmentPayload): string | null {
  return fulfillment.tracking_number ?? fulfillment.tracking_numbers?.[0] ?? null;
}

function getTrackingUrl(fulfillment: ShopifyFulfillmentPayload): string | null {
  return fulfillment.tracking_url ?? fulfillment.tracking_urls?.[0] ?? null;
}

function normalizeShipmentStatus(fulfillment: ShopifyFulfillmentPayload): string {
  const raw = (fulfillment.shipment_status ?? fulfillment.status ?? '').toLowerCase();
  if (raw.includes('deliver')) return 'delivered';
  if (raw.includes('failure') || raw.includes('error')) return 'exception';
  if (raw.includes('transit') || raw.includes('confirmed')) return 'in_transit';
  if (getTrackingNumber(fulfillment)) return 'shipped';
  return 'preparing';
}

function eventTitle(status: string): string {
  switch (status) {
    case 'delivered':
      return 'Delivered';
    case 'exception':
      return 'Delivery update needed';
    case 'in_transit':
      return 'In transit';
    case 'shipped':
      return 'Shipped';
    default:
      return 'Preparing';
  }
}

async function getUserIdForEmail(email: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  return data?.id ?? null;
}

export async function upsertOrderFromShopify(payload: ShopifyOrderPayload): Promise<OrderWithShipments | null> {
  const shopifyOrderId = normalizeId(payload.id ?? payload.admin_graphql_api_id);
  const email = (payload.email ?? payload.contact_email ?? '').trim().toLowerCase();
  const orderNumber = normalizeOrderNumber(payload);

  if (!shopifyOrderId || !email || !orderNumber) return null;

  const supabase = createAdminClient();
  const userId = await getUserIdForEmail(email);

  const { data: order, error } = await supabase
    .from('orders')
    .upsert({
      user_id: userId,
      shopify_order_id: shopifyOrderId,
      shopify_order_number: orderNumber,
      email,
      phone: payload.phone ?? null,
      financial_status: payload.financial_status ?? null,
      fulfillment_status: payload.fulfillment_status ?? null,
      total_amount: normalizeAmount(payload.current_total_price ?? payload.total_price),
      currency: payload.currency_code ?? payload.currency ?? 'USD',
      processed_at: payload.processed_at ?? null,
    }, { onConflict: 'shopify_order_id' })
    .select('*, shipments(*, shipment_events(*))')
    .single();

  if (error) throw new Error(error.message);

  for (const fulfillment of payload.fulfillments ?? []) {
    await upsertShipmentForOrder(order.id, fulfillment);
  }

  return getOrderById(order.id);
}

export async function upsertFulfillmentFromShopify(payload: ShopifyFulfillmentPayload): Promise<ShipmentWithEvents | null> {
  const shopifyOrderId = normalizeId(payload.order_id);
  if (!shopifyOrderId) return null;

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from('orders')
    .select('id')
    .eq('shopify_order_id', shopifyOrderId)
    .maybeSingle();

  if (!order) return null;
  return upsertShipmentForOrder(order.id, payload);
}

export async function upsertShipmentForOrder(orderId: string, fulfillment: ShopifyFulfillmentPayload): Promise<ShipmentWithEvents> {
  const supabase = createAdminClient();
  const fulfillmentId = normalizeId(fulfillment.id ?? fulfillment.admin_graphql_api_id) || null;
  const trackingNumber = getTrackingNumber(fulfillment);
  const status = normalizeShipmentStatus(fulfillment);
  const shippedAt = status === 'preparing' ? null : fulfillment.created_at ?? new Date().toISOString();
  const deliveredAt = status === 'delivered' ? fulfillment.updated_at ?? new Date().toISOString() : null;

  let existing: { id: string; public_lookup_token: string } | null = null;
  if (fulfillmentId) {
    const { data } = await supabase
      .from('shipments')
      .select('id, public_lookup_token')
      .eq('shopify_fulfillment_id', fulfillmentId)
      .maybeSingle();
    existing = data;
  }

  if (!existing && trackingNumber) {
    const { data } = await supabase
      .from('shipments')
      .select('id, public_lookup_token')
      .eq('order_id', orderId)
      .eq('tracking_number', trackingNumber)
      .maybeSingle();
    existing = data;
  }

  const shipmentInput = {
    order_id: orderId,
    shopify_fulfillment_id: fulfillmentId,
    tracking_number: trackingNumber,
    tracking_url: getTrackingUrl(fulfillment),
    carrier: fulfillment.tracking_company ?? null,
    status,
    estimated_delivery_at: fulfillment.estimated_delivery_at ?? null,
    shipped_at: shippedAt,
    delivered_at: deliveredAt,
    public_lookup_token: existing?.public_lookup_token ?? generateLookupToken(),
  };

  const { data: shipment, error } = existing
    ? await supabase
      .from('shipments')
      .update(shipmentInput)
      .eq('id', existing.id)
      .select('*, shipment_events(*)')
      .single()
    : await supabase
      .from('shipments')
      .insert(shipmentInput)
      .select('*, shipment_events(*)')
      .single();

  if (error) throw new Error(error.message);

  await supabase.from('shipment_events').insert({
    shipment_id: shipment.id,
    status,
    title: eventTitle(status),
    description: trackingNumber ? 'A private tracking link is available for this order.' : 'Your order is being prepared.',
    occurred_at: fulfillment.updated_at ?? fulfillment.created_at ?? new Date().toISOString(),
  });

  await maybeSendShipmentEmail(orderId, shipment.id);
  return getShipmentById(shipment.id);
}

async function maybeSendShipmentEmail(orderId: string, shipmentId: string) {
  const supabase = createAdminClient();
  const { data: existingLog } = await supabase
    .from('notification_logs')
    .select('id')
    .eq('shipment_id', shipmentId)
    .eq('event_type', 'shipment_created')
    .eq('channel', 'email')
    .maybeSingle();

  if (existingLog) return;

  const { data } = await supabase
    .from('orders')
    .select('id, shopify_order_number, email, shipments!inner(id, tracking_number, tracking_url, carrier, public_lookup_token)')
    .eq('id', orderId)
    .eq('shipments.id', shipmentId)
    .single();

  const shipment = data?.shipments?.[0];
  if (!data || !shipment?.tracking_number) return;

  const result = await sendShipmentCreatedEmail({
    to: data.email,
    orderNumber: data.shopify_order_number,
    carrier: shipment.carrier,
    trackingNumber: shipment.tracking_number,
    trackingUrl: shipment.tracking_url,
    lookupToken: shipment.public_lookup_token,
  });

  await supabase.from('notification_logs').insert({
    order_id: data.id,
    shipment_id: shipmentId,
    channel: 'email',
    event_type: 'shipment_created',
    recipient: data.email,
    provider_message_id: result.data?.id ?? null,
  });
}

export async function getOrderById(orderId: string): Promise<OrderWithShipments> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*, shipments(*, shipment_events(*))')
    .eq('id', orderId)
    .single();

  if (error) throw new Error(error.message);
  return sortOrder(data as OrderWithShipments);
}

export async function getShipmentById(shipmentId: string): Promise<ShipmentWithEvents> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('shipments')
    .select('*, shipment_events(*)')
    .eq('id', shipmentId)
    .single();

  if (error) throw new Error(error.message);
  return sortShipment(data as ShipmentWithEvents);
}

export async function getOrdersForUser(userId: string): Promise<OrderWithShipments[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*, shipments(*, shipment_events(*))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data as OrderWithShipments[]).map(sortOrder);
}

export async function lookupOrder(input: {
  token?: string;
  orderNumber?: string;
  email?: string;
  phone?: string;
}): Promise<OrderWithShipments | null> {
  const supabase = createAdminClient();

  if (input.token?.trim()) {
    const { data } = await supabase
      .from('shipments')
      .select('order_id')
      .eq('public_lookup_token', input.token.trim())
      .maybeSingle();

    return data?.order_id ? getOrderById(data.order_id) : null;
  }

  const orderNumber = input.orderNumber?.replace(/^#/, '').trim();
  const email = input.email?.trim().toLowerCase();
  const phone = input.phone?.trim();
  if (!orderNumber || (!email && !phone)) return null;

  let query = supabase
    .from('orders')
    .select('*, shipments(*, shipment_events(*))')
    .eq('shopify_order_number', orderNumber);

  query = email ? query.eq('email', email) : query.eq('phone', phone);

  const { data } = await query.maybeSingle();
  return data ? sortOrder(data as OrderWithShipments) : null;
}

function sortOrder(order: OrderWithShipments): OrderWithShipments {
  return {
    ...order,
    shipments: (order.shipments ?? [])
      .map(sortShipment)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  };
}

function sortShipment(shipment: ShipmentWithEvents): ShipmentWithEvents {
  return {
    ...shipment,
    shipment_events: (shipment.shipment_events ?? [])
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()),
  };
}
