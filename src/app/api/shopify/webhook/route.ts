import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { upsertFulfillmentFromShopify, upsertOrderFromShopify } from '@/lib/logistics';
import { recordReferralPayment, knownReferralPayment } from '@/lib/referral-rewards';

function verifyWebhook(body: Buffer, signature: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const hash = crypto.createHmac('sha256', secret).update(body).digest('base64');
  const hashBuffer = Buffer.from(hash);
  const signatureBuffer = Buffer.from(signature);
  return hashBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(hashBuffer, signatureBuffer);
}

export async function POST(req: Request) {
  const raw = Buffer.from(await req.arrayBuffer());
  const body = raw.toString('utf8');
  const signature = req.headers.get('x-shopify-hmac-sha256') ?? '';
  const topic = req.headers.get('x-shopify-topic') ?? '';

  if (!verifyWebhook(raw, signature)) {
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
    if (['orders/create','orders/paid','orders/updated','orders/fulfilled'].includes(topic) && await knownReferralPayment(eventId, expectedShop, crypto.createHash('sha256').update(raw).digest('hex'))) return NextResponse.json({ received: true, duplicate: true });
    switch (topic) {
      case 'orders/create':
      case 'orders/paid':
      case 'orders/updated':
      case 'orders/fulfilled': {
        const order = await upsertOrderFromShopify(payload);
        // A referred customer's first paid order earns the referrer their reward (once).
        if (order?.user_id && order.financial_status === 'paid') {
          await recordReferralPayment({ eventId, shop: expectedShop, hash: crypto.createHash('sha256').update(raw).digest('hex'), orderId: `gid://shopify/Order/${order.shopify_order_id.replace('gid://shopify/Order/', '')}`, userId: order.user_id });
        }
        break;
      }

      case 'fulfillments/create':
      case 'fulfillments/update':
      case 'fulfillment_events/create':
        await upsertFulfillmentFromShopify(payload);
        break;

      default:
        break;
    }
  } catch (error) {
    console.error('Shopify webhook failed:', { topic, error });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
