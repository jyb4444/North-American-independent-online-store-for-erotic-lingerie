import { NextRequest, NextResponse } from 'next/server';
import { CartError, createShopifyCart, type CartLine } from '@/lib/shopify/cart';
import { getProductByHandle } from '@/lib/products';
import { MOCK_PRODUCTS } from '@/mock/products';
import type { CartItem } from '@/types';

function isShopifyVariantGid(value?: string) {
  return !!value && value.startsWith('gid://shopify/ProductVariant/');
}

async function resolveItemToLine(item: CartItem): Promise<CartLine | null> {
  const merchandiseId = [item.shopifyVariantId, item.variantId].find(isShopifyVariantGid);
  if (merchandiseId) return { merchandiseId, quantity: item.quantity };

  const mockProduct = MOCK_PRODUCTS.find((product) =>
    product.id === item.productId ||
    product.handle === item.productId ||
    product.title === item.title
  );
  if (!mockProduct) return null;

  const shopifyProduct = await getProductByHandle(mockProduct.handle);
  const variant = shopifyProduct?.variants.find((candidate) =>
    candidate.size === item.size && candidate.color.toLowerCase() === item.color.toLowerCase()
  ) ?? shopifyProduct?.variants.find((candidate) => candidate.size === item.size)
    ?? shopifyProduct?.variants[0];

  const resolvedId = [variant?.shopifyVariantId, variant?.id].find(isShopifyVariantGid);
  return resolvedId ? { merchandiseId: resolvedId, quantity: item.quantity } : null;
}

function toQuantity(value: unknown): number | null {
  const quantity = Number(value);
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 99 ? quantity : null;
}

export async function POST(req: NextRequest) {
  let body: { lines?: unknown; items?: unknown; giftCardCode?: unknown };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Only merchandise + quantity are taken from the client; line attributes are server-controlled.
  const validLines: CartLine[] = (Array.isArray(body.lines) ? body.lines : [])
    .map((line: { merchandiseId?: unknown; quantity?: unknown }) => ({
      merchandiseId: typeof line?.merchandiseId === 'string' ? line.merchandiseId : '',
      quantity: toQuantity(line?.quantity) ?? 0,
    }))
    .filter((line) => isShopifyVariantGid(line.merchandiseId) && line.quantity > 0);
  const items = (Array.isArray(body.items) ? body.items : []) as CartItem[];
  if (items.some((item) => toQuantity(item?.quantity) === null)) {
    return NextResponse.json({ error: 'Invalid item quantity.' }, { status: 400 });
  }

  const giftCardCode = typeof body.giftCardCode === 'string' ? body.giftCardCode.trim() : '';
  if (giftCardCode.length > 64) {
    return NextResponse.json({ error: 'Invalid gift card code.' }, { status: 400 });
  }

  try {
    const resolvedLines = (await Promise.all(items.map(resolveItemToLine))).filter((line): line is CartLine => !!line);
    const cartLines = resolvedLines.length > 0 ? resolvedLines : validLines;

    if (cartLines.length === 0) {
      return NextResponse.json(
        { error: 'Your bag contains old local test items. Please remove and re-add the product.' },
        { status: 400 }
      );
    }

    const cart = await createShopifyCart({ lines: cartLines, giftCardCodes: giftCardCode ? [giftCardCode] : [] });

    return NextResponse.json({
      cartId: cart.id,
      checkoutUrl: cart.checkoutUrl,
      subtotal: cart.cost.subtotalAmount,
      total: cart.cost.totalAmount,
      appliedGiftCards: cart.appliedGiftCards,
    });
  } catch (err) {
    if (err instanceof CartError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error('Shopify cart creation failed:', err);
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 });
  }
}
