import { NextResponse } from 'next/server';
import crypto from 'crypto';

function verifyWebhook(body: string, signature: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET!;
  const hash = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  return hash === signature;
}

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('x-shopify-hmac-sha256') ?? '';
  const topic = req.headers.get('x-shopify-topic') ?? '';

  if (!verifyWebhook(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(body);

  switch (topic) {
    case 'orders/create':
      // TODO: update membership points on new order
      console.log('New order:', payload.id);
      break;

    case 'orders/fulfilled':
      // TODO: send confirmation email via Resend
      console.log('Order fulfilled:', payload.id);
      break;

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
