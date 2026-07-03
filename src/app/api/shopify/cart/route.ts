import { NextRequest, NextResponse } from 'next/server';
import { shopifyFetch } from '@/lib/shopify/client';
import { CREATE_CART_MUTATION, type CartLine, type CartCreateResult } from '@/lib/shopify/cart';
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

export async function POST(req: NextRequest) {
  try {
    const { lines, items } = (await req.json()) as { lines?: CartLine[]; items?: CartItem[] };
    const validLines = (lines ?? []).filter((line) => isShopifyVariantGid(line.merchandiseId));
    const resolvedLines = items
      ? (await Promise.all(items.map(resolveItemToLine))).filter((line): line is CartLine => !!line)
      : [];
    const cartLines = resolvedLines.length > 0 ? resolvedLines : validLines;

    if (cartLines.length === 0) {
      return NextResponse.json(
        { error: 'Your bag contains old local test items. Please remove and re-add the product.' },
        { status: 400 }
      );
    }

    const data = await shopifyFetch<CartCreateResult>({
      query: CREATE_CART_MUTATION,
      variables: { input: { lines: cartLines } },
      cache: 'no-store',
    });

    if (data.cartCreate.userErrors.length > 0) {
      return NextResponse.json(
        { error: data.cartCreate.userErrors[0].message },
        { status: 422 }
      );
    }

    return NextResponse.json({ checkoutUrl: data.cartCreate.cart.checkoutUrl });
  } catch (err) {
    console.error('Shopify cart creation failed:', err);
    return NextResponse.json({ error: 'Failed to create cart' }, { status: 500 });
  }
}
