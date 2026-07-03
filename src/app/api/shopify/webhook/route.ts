import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { upsertFulfillmentFromShopify, upsertOrderFromShopify } from '@/lib/logistics';

function verifyWebhook(body: string, signature: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const hash = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  const hashBuffer = Buffer.from(hash);
  const signatureBuffer = Buffer.from(signature);
  return hashBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(hashBuffer, signatureBuffer);
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('x-shopify-hmac-sha256') ?? '';
  const topic = req.headers.get('x-shopify-topic') ?? '';

  if (!verifyWebhook(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(body);

  try {
    switch (topic) {
      case 'orders/create':
      case 'orders/paid':
      case 'orders/updated':
      case 'orders/fulfilled':
        await upsertOrderFromShopify(payload);
        break;

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
