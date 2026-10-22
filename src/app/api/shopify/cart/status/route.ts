import { NextResponse } from 'next/server';
import { shopifyCartExists } from '@/lib/shopify/cart';
import { shopifyOrderExistsForCart } from '@/lib/shopify/admin';

// POST { cartId } → { completed, exists }. An Admin order matched by cart token is the
// authoritative completion signal. `exists` is retained for compatibility/diagnostics.
export async function POST(req: Request) {
  let cartId = '';
  try {
    const body = await req.json() as { cartId?: unknown };
    cartId = typeof body.cartId === 'string' ? body.cartId : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!/^gid:\/\/shopify\/Cart\/\S+$/.test(cartId) || cartId.length > 300) {
    return NextResponse.json({ error: 'Invalid cart id' }, { status: 400 });
  }

  try {
    const order = await shopifyOrderExistsForCart(cartId);
    if (order.completed) {
      return NextResponse.json({ completed: true, exists: false, verificationAvailable: true });
    }
    const exists = await shopifyCartExists(cartId);
    return NextResponse.json({
      completed: order.completed,
      exists,
      verificationAvailable: !order.skipped && !order.error,
    });
  } catch (error) {
    console.error('Cart status check failed:', error);
    return NextResponse.json({ error: 'Could not check cart' }, { status: 502 });
  }
}
