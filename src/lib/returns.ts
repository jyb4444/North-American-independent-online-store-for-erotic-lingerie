import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { syncReturnRequestToShopify } from '@/lib/shopify/admin';
import type { OrderItem, OrderWithShipments } from '@/lib/logistics';

export type ReturnRequestOrderSummary = {
  id: string;
  shopify_order_id: string;
  shopify_order_number: string;
  fulfillment_status: string | null;
  total_amount: number | null;
  currency: string;
  processed_at: string | null;
  created_at: string;
};

export type SignedReturnMedia = {
  path: string;
  signedUrl: string;
};

export type ReturnReason =
  | 'quality_issue'
  | 'wrong_item'
  | 'missing_item'
  | 'damaged_in_transit'
  | 'not_as_expected'
  | 'changed_mind'
  | 'size_fit'
  | 'privacy_packaging'
  | 'other';

export type DesiredResolution =
  | 'cancel_order'
  | 'refund'
  | 'return_refund'
  | 'exchange'
  | 'reship'
  | 'partial_refund';

export type ItemCondition =
  | 'unopened_tags_attached'
  | 'opened_unused'
  | 'used'
  | 'damaged'
  | 'defective';

export type ReturnRequestWithDetails = {
  id: string;
  request_number: string;
  desired_resolution: DesiredResolution;
  reason: ReturnReason;
  status: string;
  eligibility_status: 'eligible' | 'ineligible' | 'review_required';
  policy_notes: string[];
  customer_note: string | null;
  media_urls: string[];
  return_carrier: string | null;
  return_tracking_number: string | null;
  return_tracking_url: string | null;
  shopify_sync_status: string;
  shopify_sync_error: string | null;
  submitted_at: string;
  created_at: string;
  orders?: ReturnRequestOrderSummary | null;
  return_request_items: Array<{
    id: string;
    quantity: number;
    item_condition: ItemCondition;
    reason_detail: string | null;
    order_items: OrderItem;
  }>;
  return_request_events: Array<{
    id: string;
    event_type: string;
    title: string;
    description: string | null;
    created_at: string;
  }>;
};

type CreateReturnRequestInput = {
  userId: string;
  orderId: string;
  desiredResolution: DesiredResolution;
  reason: ReturnReason;
  customerNote?: string | null;
  mediaUrls?: string[];
  items: Array<{
    orderItemId: string;
    quantity: number;
    itemCondition: ItemCondition;
    reasonDetail?: string | null;
  }>;
};

const RETURN_REASONS: readonly ReturnReason[] = [
  'quality_issue', 'wrong_item', 'missing_item', 'damaged_in_transit', 'not_as_expected',
  'changed_mind', 'size_fit', 'privacy_packaging', 'other',
];
const DESIRED_RESOLUTIONS: readonly DesiredResolution[] = [
  'cancel_order', 'refund', 'return_refund', 'exchange', 'reship', 'partial_refund',
];
const ITEM_CONDITIONS: readonly ItemCondition[] = [
  'unopened_tags_attached', 'opened_unused', 'used', 'damaged', 'defective',
];
// Requests in these states no longer hold the items they listed.
const INACTIVE_REQUEST_STATUSES = ['rejected', 'closed'];
const MAX_MEDIA = 6;

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`Choose a valid ${label}.`);
  return value as T;
}

function optionalText(value: unknown, max: number, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error(`Invalid ${label}.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return text || null;
}

function httpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function requestNumber() {
  return `RMA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function daysSince(value: string | null) {
  if (!value) return null;
  const ms = Date.now() - new Date(value).getTime();
  return Math.floor(ms / 86_400_000);
}

function hasDeliveredShipment(order: OrderWithShipments) {
  return order.shipments.some((shipment) => shipment.status === 'delivered' || shipment.delivered_at);
}

function hasShippedShipment(order: OrderWithShipments) {
  return order.shipments.some((shipment) => shipment.status !== 'preparing' || shipment.tracking_number);
}

function isMerchantFault(reason: ReturnReason) {
  return ['quality_issue', 'wrong_item', 'missing_item', 'damaged_in_transit', 'privacy_packaging'].includes(reason);
}

function evaluateEligibility(input: {
  order: OrderWithShipments;
  items: Array<OrderItem & { requestedQuantity: number; itemCondition: ItemCondition }>;
  reason: ReturnReason;
  desiredResolution: DesiredResolution;
  hasMedia: boolean;
}) {
  const notes: string[] = [];
  let eligibility: 'eligible' | 'ineligible' | 'review_required' = 'eligible';
  const delivered = hasDeliveredShipment(input.order);
  const shipped = hasShippedShipment(input.order);
  // The return window runs from delivery (the latest delivered shipment), falling back to
  // the order date when there is no delivery record yet.
  const deliveredAt = input.order.shipments
    .map((shipment) => shipment.delivered_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
  const orderAgeDays = daysSince(deliveredAt ?? input.order.processed_at ?? input.order.created_at);
  const merchantFault = isMerchantFault(input.reason);

  if (input.desiredResolution === 'cancel_order') {
    if (!shipped) {
      notes.push('Order has not shipped yet; cancellation can be reviewed for a full refund.');
      return { eligibilityStatus: 'eligible' as const, notes };
    }

    notes.push('Order has shipped; cancellation may require carrier intercept or customer refusal, and original shipping may be deducted.');
    return { eligibilityStatus: 'review_required' as const, notes };
  }

  if (!delivered && shipped) {
    notes.push('Order appears shipped but not delivered; merchant review is required before approving a return or refund.');
    eligibility = 'review_required';
  }

  if (delivered && orderAgeDays !== null && orderAgeDays > 30 && !merchantFault) {
    notes.push('Return window has passed. Non-defect returns are accepted within 30 days of delivery/order activity.');
    eligibility = 'ineligible';
  }

  for (const item of input.items) {
    if (item.requestedQuantity > item.quantity) {
      notes.push(`${item.title}: requested quantity exceeds purchased quantity.`);
      eligibility = 'ineligible';
    }

    if (item.return_category === 'underwear' && !merchantFault) {
      notes.push(`${item.title}: underwear/bottom intimate items are final sale for hygiene reasons.`);
      eligibility = 'ineligible';
    }

    if (item.return_category === 'hosiery' && item.itemCondition === 'damaged' && !merchantFault) {
      notes.push(`${item.title}: damaged hosiery/stockings cannot be returned, even with tags attached.`);
      eligibility = 'ineligible';
    }

    if (['opened_unused', 'used', 'damaged'].includes(item.itemCondition) && !merchantFault) {
      notes.push(`${item.title}: opened, used, or customer-damaged items are not eligible for no-fault returns.`);
      eligibility = 'ineligible';
    }

    if (merchantFault && ['quality_issue', 'damaged_in_transit'].includes(input.reason)) {
      notes.push(input.hasMedia
        ? `${item.title}: photos received for quality or transit damage review.`
        : `${item.title}: photos are required for quality or transit damage review.`);
      if (eligibility !== 'ineligible') eligibility = 'review_required';
    }
  }

  if (input.reason === 'privacy_packaging') {
    notes.push('Privacy packaging claims are reviewed manually against the original fulfillment record.');
    if (eligibility !== 'ineligible') eligibility = 'review_required';
  }

  if (notes.length === 0) {
    notes.push('Item appears eligible for review under the unopened, tags-attached return policy.');
  }

  return { eligibilityStatus: eligibility, notes };
}

export async function getReturnRequestsForOrder(orderId: string, userId: string): Promise<ReturnRequestWithDetails[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('return_requests')
    .select('*, orders(id, shopify_order_id, shopify_order_number, fulfillment_status, total_amount, currency, processed_at, created_at), return_request_items(*, order_items(*)), return_request_events(*)')
    .eq('order_id', orderId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(sortReturnRequest) as ReturnRequestWithDetails[];
}

export async function getReturnRequestsForUser(userId: string): Promise<ReturnRequestWithDetails[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('return_requests')
    .select('*, orders(id, shopify_order_id, shopify_order_number, fulfillment_status, total_amount, currency, processed_at, created_at), return_request_items(*, order_items(*)), return_request_events(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(sortReturnRequest) as ReturnRequestWithDetails[];
}

export async function getReturnRequestForUser(returnRequestId: string, userId: string): Promise<ReturnRequestWithDetails | null> {
  return getReturnRequestById(returnRequestId, userId);
}

/** Signs return photos for display. Only paths inside `userId`'s own folder are signed. */
export async function getSignedReturnMediaUrls(paths: string[], userId: string): Promise<SignedReturnMedia[]> {
  paths = paths.filter((path) => path.startsWith(`${userId}/`) && !path.includes('..'));
  if (paths.length === 0) return [];

  const supabase = createAdminClient();
  const signed = await Promise.all(
    paths.map(async (path) => {
      const { data, error } = await supabase.storage
        .from('returns')
        .createSignedUrl(path, 60 * 30);

      if (error || !data?.signedUrl) return null;
      return { path, signedUrl: data.signedUrl };
    }),
  );

  return signed.filter((item): item is SignedReturnMedia => Boolean(item));
}

/** Return tracking links are customer-entered; only http(s) links may be rendered. */
export function isSafeTrackingUrl(value: string | null): value is string {
  return Boolean(value) && httpUrl(value!);
}

export function canCancelReturnRequest(status: string) {
  return ['submitted', 'needs_more_info', 'approved', 'awaiting_customer_shipment'].includes(status);
}

export async function createReturnRequest(input: CreateReturnRequestInput): Promise<ReturnRequestWithDetails> {
  if (input.items.length === 0) {
    throw new Error('Select at least one item for the request.');
  }
  const desiredResolution = oneOf(input.desiredResolution, DESIRED_RESOLUTIONS, 'resolution');
  const reason = oneOf(input.reason, RETURN_REASONS, 'reason');
  const customerNote = optionalText(input.customerNote, 1000, 'Note');
  const requestedItems = input.items.map((item) => {
    if (typeof item?.orderItemId !== 'string') throw new Error('One or more selected items are not part of this order.');
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error('Each item quantity must be a whole number of at least 1.');
    return {
      orderItemId: item.orderItemId,
      quantity: item.quantity,
      itemCondition: oneOf(item.itemCondition, ITEM_CONDITIONS, 'item condition'),
      reasonDetail: optionalText(item.reasonDetail, 300, 'Item detail'),
    };
  });
  if (new Set(requestedItems.map((item) => item.orderItemId)).size !== requestedItems.length) {
    throw new Error('Each item can only be listed once per request.');
  }
  // Photos must be files this user uploaded to their own folder in the private bucket;
  // the server signs these paths with the service role.
  const mediaUrls = input.mediaUrls ?? [];
  if (mediaUrls.length > MAX_MEDIA) throw new Error(`Upload up to ${MAX_MEDIA} photos.`);
  for (const path of mediaUrls) {
    if (typeof path !== 'string' || !path.startsWith(`${input.userId}/`) || path.includes('..')) {
      throw new Error('Invalid photo upload. Please upload your photos again.');
    }
  }

  const supabase = createAdminClient();
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, order_items(*), shipments(*, shipment_events(*))')
    .eq('id', input.orderId)
    .eq('user_id', input.userId)
    .single();

  if (orderError || !order) throw new Error('Order not found.');

  const orderWithItems = order as OrderWithShipments;
  const itemMap = new Map((orderWithItems.order_items ?? []).map((item) => [item.id, item]));

  // Quantities already held by this order's other active requests.
  const { data: activeRequests, error: activeError } = await supabase
    .from('return_requests')
    .select('status, return_request_items(order_item_id, quantity)')
    .eq('order_id', input.orderId);
  if (activeError) throw new Error(activeError.message);
  const alreadyRequested = new Map<string, number>();
  for (const request of activeRequests ?? []) {
    if (INACTIVE_REQUEST_STATUSES.includes(request.status)) continue;
    for (const item of request.return_request_items ?? []) {
      alreadyRequested.set(item.order_item_id, (alreadyRequested.get(item.order_item_id) ?? 0) + item.quantity);
    }
  }

  for (const item of requestedItems) {
    const orderItem = itemMap.get(item.orderItemId);
    if (!orderItem) throw new Error('One or more selected items are not part of this order.');
    const remaining = orderItem.quantity - (alreadyRequested.get(item.orderItemId) ?? 0);
    if (item.quantity > remaining) {
      throw new Error(remaining > 0
        ? `${orderItem.title}: only ${remaining} more can be requested (some are already in another request).`
        : `${orderItem.title} is already part of an open request.`);
    }
  }

  const selectedItems = requestedItems.map((item) => {
    const orderItem = itemMap.get(item.orderItemId);
    if (!orderItem) throw new Error('One or more selected items are not part of this order.');
    return {
      ...orderItem,
      requestedQuantity: item.quantity,
      itemCondition: item.itemCondition,
    };
  });

  const { eligibilityStatus, notes } = evaluateEligibility({
    order: orderWithItems,
    items: selectedItems,
    reason,
    desiredResolution,
    hasMedia: mediaUrls.length > 0,
  });

  const { data: request, error: requestError } = await supabase
    .from('return_requests')
    .insert({
      user_id: input.userId,
      order_id: input.orderId,
      request_number: requestNumber(),
      desired_resolution: desiredResolution,
      reason,
      eligibility_status: eligibilityStatus,
      status: eligibilityStatus === 'ineligible' ? 'rejected' : 'submitted',
      policy_notes: notes,
      customer_note: customerNote,
      media_urls: mediaUrls,
    })
    .select('*')
    .single();

  if (requestError) throw new Error(requestError.message);

  const rows = requestedItems.map((item) => ({
    return_request_id: request.id,
    order_item_id: item.orderItemId,
    quantity: item.quantity,
    item_condition: item.itemCondition,
    reason_detail: item.reasonDetail,
  }));

  const { error: itemsError } = await supabase.from('return_request_items').insert(rows);
  if (itemsError) {
    // Do not leave a request without items behind.
    await supabase.from('return_requests').delete().eq('id', request.id);
    throw new Error(itemsError.message);
  }

  await supabase.from('return_request_events').insert({
    return_request_id: request.id,
    event_type: 'submitted',
    title: eligibilityStatus === 'ineligible' ? 'Request received but not eligible' : 'Return request submitted',
    description: notes.join(' '),
    metadata: { eligibility_status: eligibilityStatus },
  });

  await syncRequestToShopify(request.id, orderWithItems.shopify_order_id);
  const created = await getReturnRequestById(request.id, input.userId);
  if (!created) throw new Error('Return request could not be loaded.');
  return created;
}

export async function updateReturnTracking(input: {
  userId: string;
  returnRequestId: string;
  carrier?: unknown;
  trackingNumber: unknown;
  trackingUrl?: unknown;
}) {
  const trackingNumber = optionalText(input.trackingNumber, 64, 'Tracking number');
  if (!trackingNumber) throw new Error('Enter the return tracking number.');
  const carrier = optionalText(input.carrier, 64, 'Carrier');
  const trackingUrl = optionalText(input.trackingUrl, 500, 'Tracking link');
  if (trackingUrl && !httpUrl(trackingUrl)) throw new Error('Tracking link must start with http:// or https://.');

  const supabase = createAdminClient();
  const { data: request, error: requestError } = await supabase
    .from('return_requests')
    .select('id, status')
    .eq('id', input.returnRequestId)
    .eq('user_id', input.userId)
    .single();

  if (requestError || !request) throw new Error('Return request not found.');

  if (!['approved', 'awaiting_customer_shipment', 'customer_shipped'].includes(request.status)) {
    throw new Error('Tracking can be added after the return is approved.');
  }

  const { error } = await supabase
    .from('return_requests')
    .update({
      status: 'customer_shipped',
      return_carrier: carrier,
      return_tracking_number: trackingNumber,
      return_tracking_url: trackingUrl,
    })
    .eq('id', input.returnRequestId)
    .eq('user_id', input.userId);

  if (error) throw new Error(error.message);

  await supabase.from('return_request_events').insert({
    return_request_id: input.returnRequestId,
    event_type: 'customer_shipped',
    title: 'Return tracking added',
    description: trackingNumber,
  });

  return getReturnRequestById(input.returnRequestId, input.userId);
}

export async function cancelReturnRequest(input: {
  userId: string;
  returnRequestId: string;
}) {
  const supabase = createAdminClient();
  const request = await getReturnRequestById(input.returnRequestId, input.userId);

  if (!request) throw new Error('Return request not found.');
  if (!canCancelReturnRequest(request.status)) {
    throw new Error('This return request can no longer be cancelled online.');
  }

  const { error } = await supabase
    .from('return_requests')
    .update({
      status: 'closed',
      admin_notes: 'Customer cancelled this return request.',
    })
    .eq('id', input.returnRequestId)
    .eq('user_id', input.userId);

  if (error) throw new Error(error.message);

  await supabase.from('return_request_events').insert({
    return_request_id: input.returnRequestId,
    event_type: 'customer_cancelled',
    title: 'Return request cancelled',
    description: 'The customer cancelled this return request before return processing was completed.',
  });

  if (request.orders?.shopify_order_id) {
    await syncRequestToShopify(input.returnRequestId, request.orders.shopify_order_id);
  }

  return getReturnRequestById(input.returnRequestId, input.userId);
}

async function syncRequestToShopify(returnRequestId: string, shopifyOrderId: string) {
  const supabase = createAdminClient();
  const request = await getReturnRequestById(returnRequestId);
  if (!request) return;

  const result = await syncReturnRequestToShopify({
    orderId: shopifyOrderId,
    requestNumber: request.request_number,
    status: request.status,
    eligibilityStatus: request.eligibility_status,
    reason: request.reason,
    desiredResolution: request.desired_resolution,
    itemTitles: request.return_request_items.map((item) => item.order_items.title),
  });

  await supabase
    .from('return_requests')
    .update({
      shopify_sync_status: result.skipped ? 'skipped' : result.error ? 'failed' : 'synced',
      shopify_sync_error: result.error,
      shopify_synced_at: result.error || result.skipped ? null : new Date().toISOString(),
    })
    .eq('id', returnRequestId);
}

async function getReturnRequestById(returnRequestId: string, userId?: string): Promise<ReturnRequestWithDetails | null> {
  const supabase = createAdminClient();
  let query = supabase
    .from('return_requests')
    .select('*, orders(id, shopify_order_id, shopify_order_number, fulfillment_status, total_amount, currency, processed_at, created_at), return_request_items(*, order_items(*)), return_request_events(*)')
    .eq('id', returnRequestId);

  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data ? sortReturnRequest(data) as ReturnRequestWithDetails : null;
}

function sortReturnRequest(request: unknown) {
  const typed = request as ReturnRequestWithDetails;
  return {
    ...typed,
    return_request_events: (typed.return_request_events ?? [])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
  };
}
