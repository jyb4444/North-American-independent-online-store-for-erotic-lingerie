import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { enqueueNotification } from '@/lib/notification-jobs';
import { shopifyAdminFetch } from '@/lib/shopify/admin';
import { readOrderAttribution } from '@/lib/shopify/order-attribution';

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

export type OrderItem = {
  id: string;
  shopify_line_item_id: string;
  shopify_variant_id: string | null;
  title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  price: number | null;
  product_type: string | null;
  vendor: string | null;
  return_category: string;
};

export type OrderWithShipments = {
  id: string;
  user_id: string | null;
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
  order_items?: OrderItem[];
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
  line_items?: ShopifyLineItemPayload[];
  note_attributes?: Array<{ name?: string | null; value?: string | null }>;
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

type ShopifyLineItemPayload = {
  id?: number | string;
  admin_graphql_api_id?: string;
  variant_id?: number | string | null;
  variant_admin_graphql_api_id?: string | null;
  title?: string | null;
  name?: string | null;
  variant_title?: string | null;
  sku?: string | null;
  quantity?: number | string | null;
  price?: string | number | null;
  product_type?: string | null;
  vendor?: string | null;
};

type ShopifyAdminOrderNode = {
  legacyResourceId: string;
  name: string;
  email: string | null;
  phone: string | null;
  displayFinancialStatus: string | null;
  displayFulfillmentStatus: string | null;
  createdAt: string;
  processedAt: string | null;
  currentTotalPriceSet: {
    shopMoney: {
      amount: string;
      currencyCode: string;
    };
  };
  lineItems: {
    nodes: Array<{
      id: string;
      title: string;
      quantity: number;
      variantTitle: string | null;
      sku: string | null;
      vendor: string | null;
      originalUnitPriceSet: {
        shopMoney: {
          amount: string;
          currencyCode: string;
        };
      };
    }>;
  };
  customAttributes?: Array<{ key: string; value: string | null }>;
};

export function canonicalShopifyId(value: unknown, resource?: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  if (!resource) return normalized.replace(/^gid:\/\/shopify\/[^/]+\//, '');
  return normalized.replace(new RegExp(`^gid://shopify/${resource}/`), '');
}

function normalizeOrderNumber(payload: ShopifyOrderPayload): string {
  return String(payload.name ?? payload.order_number ?? payload.id ?? '').replace(/^#/, '');
}

function normalizeAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function shopifyOrderEmailQuery(email: string): string {
  const escaped = email.trim().toLowerCase().replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `email:"${escaped}"`;
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

export function normalizeShipmentStatus(fulfillment: ShopifyFulfillmentPayload): string {
  const raw = (fulfillment.shipment_status ?? fulfillment.status ?? '').toLowerCase().replace(/[\s-]+/g, '_');
  if (raw === 'delivered') return 'delivered';
  if (['failure', 'failed', 'error', 'attempted_delivery'].includes(raw)) return 'exception';
  if (['in_transit', 'out_for_delivery', 'confirmed'].includes(raw)) return 'in_transit';
  if (['cancelled', 'canceled'].includes(raw)) return 'cancelled';
  if (getTrackingNumber(fulfillment)) return 'shipped';
  return 'preparing';
}

function normalizeStatus(value: string | null | undefined): string | null {
  return value ? value.toLowerCase().replace(/\s+/g, '_') : null;
}

function classifyReturnCategory(lineItem: ShopifyLineItemPayload): string {
  const haystack = [
    lineItem.title,
    lineItem.name,
    lineItem.variant_title,
    lineItem.product_type,
    lineItem.sku,
  ].filter(Boolean).join(' ').toLowerCase();

  if (/(内裤|丁字裤)|\b(panty|panties|underwear|brief|briefs|thong|g-string|gstring|crotch)\b/.test(haystack)) {
    return 'underwear';
  }

  if (/(丝袜|连裤袜)|\b(stocking|stockings|hosiery|tights|pantyhose|garter socks)\b/.test(haystack)) {
    return 'hosiery';
  }

  return 'general';
}

function normalizeQuantity(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 1;
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

function getEventTimestamp(fulfillment: ShopifyFulfillmentPayload): string {
  return fulfillment.updated_at ?? fulfillment.created_at ?? new Date().toISOString();
}

// Matches the account whose *confirmed* auth email equals the order email (case-insensitive,
// no pattern matching). profiles.email is not used: it is not a verified identity.
async function getUserIdForEmail(email: string): Promise<string | null> {
  const { data, error } = await createAdminClient().rpc('confirmed_user_id_for_email', { p_email: email });
  if (error) {
    if (!['PGRST202', '42883'].includes(error.code)) throw new Error('Order owner lookup failed');
    // Compatibility release: only a missing RPC permits this fallback. Never use profiles.email.
    const admin = createAdminClient();
    const matches: string[] = [];
    for (let page = 1; page <= 100; page++) {
      const result = await admin.auth.admin.listUsers({ page, perPage: 100 });
      if (result.error) throw new Error('Confirmed identity lookup unavailable');
      matches.push(...result.data.users.filter((u) => u.email_confirmed_at && u.email?.toLowerCase() === email.trim().toLowerCase()).map((u) => u.id));
      if (result.data.users.length < 100) return matches.length === 1 ? matches[0] : null;
    }
    throw new Error('Confirmed identity lookup incomplete');
  }
  return typeof data === 'string' ? data : null;
}

export async function upsertOrderFromShopify(payload: ShopifyOrderPayload): Promise<OrderWithShipments | null> {
  const shopifyOrderId = canonicalShopifyId(payload.id ?? payload.admin_graphql_api_id, 'Order');
  const email = (payload.email ?? payload.contact_email ?? '').trim().toLowerCase();
  const orderNumber = normalizeOrderNumber(payload);

  if (!shopifyOrderId || !email || !orderNumber) return null;

  const supabase = createAdminClient();
  const attributedUserId = readOrderAttribution(payload.note_attributes);
  const userId = attributedUserId ?? await getUserIdForEmail(email);

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

  for (const lineItem of payload.line_items ?? []) {
    await upsertOrderItem(order.id, lineItem);
  }

  for (const fulfillment of payload.fulfillments ?? []) {
    await upsertShipmentForOrder(order.id, fulfillment);
  }

  return getOrderById(order.id);
}

async function upsertAdminOrderForUser(node: ShopifyAdminOrderNode, userId: string): Promise<OrderWithShipments | null> {
  const email = (node.email ?? '').trim().toLowerCase();
  const orderNumber = String(node.name ?? node.legacyResourceId ?? '').replace(/^#/, '');
  if (!node.legacyResourceId || !email || !orderNumber) return null;

  const supabase = createAdminClient();
  const { data: order, error } = await supabase
    .from('orders')
    .upsert({
      user_id: userId,
      shopify_order_id: node.legacyResourceId,
      shopify_order_number: orderNumber,
      email,
      phone: node.phone ?? null,
      financial_status: normalizeStatus(node.displayFinancialStatus),
      fulfillment_status: normalizeStatus(node.displayFulfillmentStatus),
      total_amount: normalizeAmount(node.currentTotalPriceSet.shopMoney.amount),
      currency: node.currentTotalPriceSet.shopMoney.currencyCode,
      processed_at: node.processedAt ?? node.createdAt,
    }, { onConflict: 'shopify_order_id' })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  for (const lineItem of node.lineItems.nodes ?? []) {
    await upsertOrderItem(order.id, {
      id: lineItem.id,
      title: lineItem.title,
      variant_title: lineItem.variantTitle,
      sku: lineItem.sku,
      quantity: lineItem.quantity,
      price: lineItem.originalUnitPriceSet.shopMoney.amount,
      vendor: lineItem.vendor,
    });
  }

  return getOrderById(order.id);
}

export async function syncShopifyOrdersForUser(input: {
  userId: string;
  email: string;
  limit?: number;
}): Promise<number> {
  const email = input.email.trim().toLowerCase();
  if (!email) return 0;

  const result = await shopifyAdminFetch<{
    orders: {
      nodes: ShopifyAdminOrderNode[];
    };
  }>({
    query: `
      query OrdersForAccount($first: Int!, $query: String!) {
        orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
          nodes {
            legacyResourceId
            name
            email
            phone
            displayFinancialStatus
            displayFulfillmentStatus
            createdAt
            processedAt
            customAttributes { key value }
            currentTotalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            lineItems(first: 50) {
              nodes {
                id
                title
                quantity
                variantTitle
                sku
                vendor
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
              }
            }
          }
        }
      }
    `,
    variables: {
      first: Math.max(1, Math.min(input.limit ?? 100, 250)),
      query: shopifyOrderEmailQuery(email),
    },
  });

  if (result.skipped) return 0;
  if (result.error) throw new Error(result.error);

  let synced = 0;
  for (const order of result.data?.orders.nodes ?? []) {
    const attributedUserId = readOrderAttribution(order.customAttributes);
    if (attributedUserId !== input.userId && order.email?.trim().toLowerCase() !== email) continue;
    const upserted = await upsertAdminOrderForUser(order, input.userId);
    if (upserted) synced += 1;
  }

  return synced;
}

async function upsertOrderItem(orderId: string, lineItem: ShopifyLineItemPayload): Promise<void> {
  const lineItemId = canonicalShopifyId(lineItem.id ?? lineItem.admin_graphql_api_id, 'LineItem');
  const title = (lineItem.title ?? lineItem.name ?? '').trim();
  if (!lineItemId || !title) return;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('order_items')
    .upsert({
      order_id: orderId,
      shopify_line_item_id: lineItemId,
      shopify_variant_id: canonicalShopifyId(lineItem.variant_admin_graphql_api_id ?? lineItem.variant_id, 'ProductVariant') || null,
      title,
      variant_title: lineItem.variant_title ?? null,
      sku: lineItem.sku ?? null,
      quantity: normalizeQuantity(lineItem.quantity),
      price: normalizeAmount(lineItem.price),
      product_type: lineItem.product_type ?? null,
      vendor: lineItem.vendor ?? null,
      return_category: classifyReturnCategory(lineItem),
    }, { onConflict: 'order_id,shopify_line_item_id' });

  if (error) throw new Error(error.message);
}

export async function upsertFulfillmentFromShopify(payload: ShopifyFulfillmentPayload): Promise<ShipmentWithEvents | null> {
  const shopifyOrderId = canonicalShopifyId(payload.order_id, 'Order');
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
  const fulfillmentId = canonicalShopifyId(fulfillment.id ?? fulfillment.admin_graphql_api_id, 'Fulfillment') || null;
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

  const eventOccurredAt = getEventTimestamp(fulfillment);
  const { data: existingEvent } = await supabase
    .from('shipment_events')
    .select('id')
    .eq('shipment_id', shipment.id)
    .eq('status', status)
    .eq('occurred_at', eventOccurredAt)
    .limit(1)
    .maybeSingle();

  if (!existingEvent) {
    await supabase.from('shipment_events').insert({
      shipment_id: shipment.id,
      status,
      title: eventTitle(status),
      description: trackingNumber ? 'A private tracking link is available for this order.' : 'Your order is being prepared.',
      occurred_at: eventOccurredAt,
    });
  }

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

  await enqueueNotification('shipment_created', `shipment-created:${shipmentId}`, {
    orderId: data.id,
    shipmentId,
    to: data.email,
    orderNumber: data.shopify_order_number,
    carrier: shipment.carrier,
    trackingNumber: shipment.tracking_number,
    trackingUrl: shipment.tracking_url,
    lookupToken: shipment.public_lookup_token,
  });
}

export async function getOrderById(orderId: string): Promise<OrderWithShipments> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), shipments(*, shipment_events(*))')
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

export async function getOrdersForUser(
  userId: string,
  supabase: SupabaseClient = createAdminClient(),
): Promise<OrderWithShipments[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), shipments(*, shipment_events(*))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data as OrderWithShipments[]).map(sortOrder);
}

export async function getOrderForUser(orderId: string, userId: string): Promise<OrderWithShipments | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), shipments(*, shipment_events(*))')
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? sortOrder(data as OrderWithShipments) : null;
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
    .select('*, order_items(*), shipments(*, shipment_events(*))')
    .eq('shopify_order_number', orderNumber);

  query = email ? query.eq('email', email) : query.eq('phone', phone);

  const { data } = await query.maybeSingle();
  return data ? sortOrder(data as OrderWithShipments) : null;
}

function sortOrder(order: OrderWithShipments): OrderWithShipments {
  return {
    ...order,
    order_items: (order.order_items ?? [])
      .sort((a, b) => a.title.localeCompare(b.title)),
    shipments: (order.shipments ?? [])
      .map(sortShipment)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  };
}

function sortShipment(shipment: ShipmentWithEvents): ShipmentWithEvents {
  const uniqueEvents = new Map<string, ShipmentEvent>();
  for (const event of shipment.shipment_events ?? []) {
    const key = [
      event.status,
      event.title,
      event.description ?? '',
      event.location ?? '',
      event.occurred_at,
    ].join('|');
    if (!uniqueEvents.has(key)) uniqueEvents.set(key, event);
  }

  return {
    ...shipment,
    shipment_events: Array.from(uniqueEvents.values())
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()),
  };
}
