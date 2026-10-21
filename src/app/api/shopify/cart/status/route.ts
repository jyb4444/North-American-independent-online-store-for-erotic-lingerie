import { NextResponse } from 'next/server';
import { shopifyCartExists } from '@/lib/shopify/cart';

// POST { cartId } → { exists }. Lets the bag find out whether a checkout became an order.
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
    return NextResponse.json({ exists: await shopifyCartExists(cartId) });
  } catch (error) {
    console.error('Cart status check failed:', error);
    return NextResponse.json({ error: 'Could not check cart' }, { status: 502 });
  }
}
