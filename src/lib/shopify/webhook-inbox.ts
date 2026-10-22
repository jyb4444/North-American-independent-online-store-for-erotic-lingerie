import { createAdminClient } from '@/lib/supabase/server';
import { canonicalShopifyId, upsertFulfillmentFromShopify } from '@/lib/logistics';

type FulfillmentPayload = Record<string, unknown> & { order_id?: string | number };
type InboxRow = {
  event_id: string;
  body_hash: string;
  shop_domain: string;
  payload: FulfillmentPayload;
  attempts: number;
  status: string;
  lease_token: string;
  lease_until?: string | null;
};

function missingInbox(error: { code?: string } | null) {
  return !!error && ['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code ?? '');
}

function nextAttempt(attempts: number) {
  const seconds = Math.min(24 * 60 * 60, 60 * 2 ** Math.min(Math.max(attempts, 0), 10));
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function processRow(row: InboxRow) {
  const db = createAdminClient();
  try {
    const shipment = await upsertFulfillmentFromShopify(row.payload);
    if (!shipment) {
      const attempts = row.attempts;
      await db.from('shopify_webhook_inbox' as never).update({
        status: attempts >= 8 ? 'manual_review' : 'pending',
        attempts,
        next_attempt_at: nextAttempt(attempts),
        last_error: 'Order has not arrived yet',
        lease_token: null,
        lease_until: null,
      } as never).eq('event_id', row.event_id).eq('lease_token', row.lease_token);
      return false;
    }
    await db.from('shopify_webhook_inbox' as never).update({
      status: 'complete', completed_at: new Date().toISOString(), last_error: null,
      lease_token: null, lease_until: null,
    } as never).eq('event_id', row.event_id).eq('lease_token', row.lease_token);
    return true;
  } catch (error) {
    const attempts = row.attempts;
    await db.from('shopify_webhook_inbox' as never).update({
      status: attempts >= 8 ? 'manual_review' : 'failed',
      attempts,
      next_attempt_at: nextAttempt(attempts),
      last_error: error instanceof Error ? error.message.slice(0, 500) : 'Fulfillment processing failed',
      lease_token: null,
      lease_until: null,
    } as never).eq('event_id', row.event_id).eq('lease_token', row.lease_token);
    throw error;
  }
}

export async function acceptFulfillmentWebhook(input: {
  eventId: string;
  topic: string;
  shop: string;
  bodyHash: string;
  payload: FulfillmentPayload;
}) {
  const db = createAdminClient();
  const orderId = canonicalShopifyId(input.payload.order_id, 'Order') || null;
  const { error } = await db.from('shopify_webhook_inbox' as never).upsert({
    event_id: input.eventId,
    topic: input.topic,
    shop_domain: input.shop,
    body_hash: input.bodyHash,
    shopify_order_id: orderId,
    payload: input.payload,
  } as never, { onConflict: 'event_id', ignoreDuplicates: true } as never);

  // Compatibility path before the inbox migration: process immediately and make Shopify retry
  // if the order has not arrived, instead of acknowledging and losing the fulfillment.
  if (missingInbox(error)) {
    const shipment = await upsertFulfillmentFromShopify(input.payload);
    if (!shipment) throw new Error('Order has not arrived; fulfillment must be retried');
    return { duplicate: false, durable: false };
  }
  if (error) throw new Error('Webhook inbox is unavailable');

  const { data, error: readError } = await db.from('shopify_webhook_inbox' as never)
    .select('event_id,body_hash,shop_domain,status')
    .eq('event_id', input.eventId).single() as { data: InboxRow | null; error: { message?: string } | null };
  if (readError || !data) throw new Error('Webhook inbox record could not be verified');
  if (data.body_hash !== input.bodyHash || data.shop_domain !== input.shop) throw new Error('Webhook event identity conflict');
  if (data.status === 'complete') return { duplicate: true, durable: true };
  await replayPendingFulfillments(orderId ?? undefined, 1);
  return { duplicate: false, durable: true };
}

export async function replayPendingFulfillments(shopifyOrderId?: string, limit = 25) {
  const db = createAdminClient();
  const { data, error } = await db.rpc('lease_shopify_webhook_events' as never, {
    p_limit: Math.max(1, Math.min(limit, 100)),
    p_order_id: shopifyOrderId ? canonicalShopifyId(shopifyOrderId, 'Order') : null,
  } as never) as { data: InboxRow[] | null; error: { code?: string } | null };
  if (missingInbox(error)) return { processed: 0, failed: 0 };
  if (error) throw new Error('Webhook inbox could not be read');
  let processed = 0;
  let failed = 0;
  for (const row of data ?? []) {
    try {
      if (await processRow(row)) processed += 1;
    } catch {
      failed += 1;
    }
  }
  return { processed, failed };
}
