const MOCK_URL = 'http://127.0.0.1:3199';

type RecordedRequest = { query: string; variables?: { input?: CartCreateInput; handle?: string } };

export type CartCreateInput = {
  lines: { merchandiseId: string; quantity: number; attributes?: { key: string; value: string }[] }[];
  giftCardCodes?: string[];
  buyerIdentity?: { email?: string };
};

export const GIFT_CARD_VARIANT = {
  $25: 'gid://shopify/ProductVariant/9000025',
  $50: 'gid://shopify/ProductVariant/9000050',
  $100: 'gid://shopify/ProductVariant/9000100',
  unavailable$500: 'gid://shopify/ProductVariant/9000500',
} as const;

/** A regular (non gift card) product variant; the mock prices it at $30. */
export const REGULAR_VARIANT = 'gid://shopify/ProductVariant/1001';

/** Gift cards the mock Storefront API knows about. */
export const MOCK_GIFT_CARD = { code: 'GIFTE2E0000ABCD', balance: 40, emptyCode: 'GIFTE2EEMPTY0000' } as const;

export async function resetShopifyMock() {
  await fetch(`${MOCK_URL}/__reset`, { method: 'POST' });
}

/** `cartCreate` inputs the app sent to the (mock) Storefront API since the last reset. */
export async function recordedCartCreates(): Promise<CartCreateInput[]> {
  const requests = (await (await fetch(`${MOCK_URL}/__requests`)).json()) as RecordedRequest[];
  return requests
    .filter((request) => /mutation\s+cartCreate\b/.test(request.query))
    .map((request) => request.variables!.input!);
}

/** Simulates Shopify turning a cart into an order (Shopify then deletes the cart). */
export async function completeShopifyCart(cartId: string) {
  await fetch(`${MOCK_URL}/__complete-cart`, { method: 'POST', body: JSON.stringify({ id: cartId }) });
}

type AdminRequest = { query: string; variables?: { basicCodeDiscount?: Record<string, unknown> } };

/** Discount codes the app asked the (mock) Admin API to create since the last reset. */
export async function recordedDiscountCreates(): Promise<Record<string, unknown>[]> {
  const requests = (await (await fetch(`${MOCK_URL}/__admin-requests`)).json()) as AdminRequest[];
  return requests
    .filter((request) => /mutation\s+CreateRewardDiscount\b/.test(request.query))
    .map((request) => request.variables!.basicCodeDiscount!);
}

/** Makes the next discount creation fail like a missing write_discounts scope would. */
export async function failNextDiscountCreate() {
  await fetch(`${MOCK_URL}/__admin-fail`, { method: 'POST' });
}
