import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { upsertOrderFromShopify } from '@/lib/logistics';
import { recordReferralPayment, knownReferralPayment } from '@/lib/referral-rewards';
import { acceptFulfillmentWebhook, replayPendingFulfillments } from '@/lib/shopify/webhook-inbox';
import { verifyShopifyWebhook } from '@/lib/shopify/webhook-signature';

export async function POST(req: Request) {
  const raw = Buffer.from(await req.arrayBuffer());
  const body = raw.toString('utf8');
  const signature = req.headers.get('x-shopify-hmac-sha256') ?? '';
  const topic = req.headers.get('x-shopify-topic') ?? '';

  if (!verifyShopifyWebhook(raw, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const shop = req.headers.get('x-shopify-shop-domain')?.toLowerCase();
  const expectedShop = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN?.toLowerCase();
  if (!expectedShop || shop !== expectedShop) return NextResponse.json({ error: 'Invalid shop' }, { status: 401 });
  const eventId = req.headers.get('x-shopify-event-id') || req.headers.get('x-shopify-webhook-id');
  if (!eventId || !/^[a-zA-Z0-9-]{1,128}$/.test(eventId)) return NextResponse.json({ error: 'Missing valid event ID' }, { status: 400 });
  let payload;
  try {
    payload = JSON.parse(body);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid payload');
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const bodyHash = crypto.createHash('sha256').update(raw).digest('hex');
    if (['orders/create','orders/paid','orders/updated','orders/fulfilled'].includes(topic) && await knownReferralPayment(eventId, expectedShop, bodyHash)) return NextResponse.json({ received: true, duplicate: true });
    switch (topic) {
      case 'orders/create':
      case 'orders/paid':
      case 'orders/updated':
      case 'orders/fulfilled': {
        const order = await upsertOrderFromShopify(payload);
        if (order) await replayPendingFulfillments(order.shopify_order_id);
        // A referred customer's first paid order earns the referrer their reward (once).
        if (order?.user_id && order.financial_status === 'paid') {
          await recordReferralPayment({ eventId, shop: expectedShop, hash: bodyHash, orderId: `gid://shopify/Order/${order.shopify_order_id}`, userId: order.user_id });
        }
        break;
      }

      case 'fulfillments/create':
      case 'fulfillments/update':
        await acceptFulfillmentWebhook({ eventId, topic, shop: expectedShop, bodyHash, payload });
        break;

      case 'fulfillment_events/create':
        // This payload contains `fulfillment_id`, not a full fulfillment. Treating its
        // event id as a fulfillment id creates phantom shipments, so ignore it until a
        // dedicated parent-fulfillment reconciler exists.
        return NextResponse.json({ received: true, ignored: true });

      default:
        break;
    }
  } catch (error) {
    console.error('Shopify webhook failed:', { topic, error });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
