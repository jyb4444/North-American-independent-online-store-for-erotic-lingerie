// Shopify Storefront API — Cart mutations
// Flow: cartCreate → get checkoutUrl → redirect user to Shopify checkout
import { shopifyFetch } from '@/lib/shopify/client';

export const CREATE_CART_MUTATION = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        cost {
          subtotalAmount {
            amount
            currencyCode
          }
          totalAmount {
            amount
            currencyCode
          }
        }
        appliedGiftCards {
          lastCharacters
          amountUsed {
            amount
            currencyCode
          }
          balance {
            amount
            currencyCode
          }
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

export type CartLineAttribute = { key: string; value: string };

export type CartLine = {
  merchandiseId: string;  // gid://shopify/ProductVariant/XXXXX
  quantity: number;
  attributes?: CartLineAttribute[];
};

type Money = { amount: string; currencyCode: string };

export type AppliedGiftCard = {
  lastCharacters: string;
  amountUsed: Money;
  balance: Money;
};

export type CartCreateResult = {
  cartCreate: {
    cart: {
      id: string;
      checkoutUrl: string;
      cost: { subtotalAmount: Money; totalAmount: Money };
      appliedGiftCards: AppliedGiftCard[];
    } | null;
    userErrors: { field: string[] | null; message: string; code?: string | null }[];
  };
};

export class CartError extends Error {}

export function normalizeGiftCardCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase();
}

/**
 * Creates a Shopify cart. Gift card codes are redeemed by Shopify itself: an unknown,
 * expired or empty card is not reported as an error, it is simply missing from
 * `appliedGiftCards`, so every requested code is checked against that list.
 */
export async function createShopifyCart(input: {
  lines: CartLine[];
  giftCardCodes?: string[];
  buyerEmail?: string;
  buyerIp?: string;
  attributes?: CartLineAttribute[];
}) {
  const giftCardCodes = (input.giftCardCodes ?? []).map(normalizeGiftCardCode).filter(Boolean);
  const buyerEmail = input.buyerEmail?.trim().toLowerCase();

  const data = await shopifyFetch<CartCreateResult>({
    query: CREATE_CART_MUTATION,
    variables: {
      input: {
        lines: input.lines,
        ...(input.attributes?.length ? { attributes: input.attributes } : {}),
        ...(giftCardCodes.length > 0 ? { giftCardCodes } : {}),
        ...(buyerEmail ? { buyerIdentity: { email: buyerEmail } } : {}),
      },
    },
    cache: 'no-store',
    buyerIp: input.buyerIp,
  });

  const { cart, userErrors } = data.cartCreate;
  if (userErrors.length > 0 || !cart) {
    throw new CartError(userErrors[0]?.message ?? 'Could not create cart');
  }

  for (const code of giftCardCodes) {
    const compact = code.replace(/[^A-Z0-9]/g, '');
    const applied = cart.appliedGiftCards.some((card) =>
      compact.endsWith(card.lastCharacters.toUpperCase().replace(/[^A-Z0-9]/g, ''))
    );
    if (!applied) {
      throw new CartError('This gift card code could not be applied. Check the code, its balance and expiry date.');
    }
  }

  return cart;
}

const CART_STATUS_QUERY = `
  query CartStatus($id: ID!) {
    cart(id: $id) {
      id
    }
  }
`;

/**
 * Whether a Shopify cart still exists. Shopify deletes a cart when its checkout becomes an
 * order (and when it expires, ~10 days after its last update), so `false` after a recent
 * checkout means the order was placed.
 */
export async function shopifyCartExists(cartId: string): Promise<boolean> {
  const data = await shopifyFetch<{ cart: { id: string } | null }>({
    query: CART_STATUS_QUERY,
    variables: { id: cartId },
    cache: 'no-store',
  });
  return data.cart !== null;
}
