// Gift cards are native Shopify gift card products: Shopify charges for them at checkout,
// issues the code, emails it (optionally to a recipient) and redeems it at checkout.
import { hasShopifyConfig, shopifyFetch } from '@/lib/shopify/client';
import type { CartLineAttribute } from '@/lib/shopify/cart';

const GIFT_CARD_PRODUCT_QUERY = `
  query GiftCardProduct($handle: String!) {
    product(handle: $handle) {
      id
      title
      isGiftCard
      variants(first: 20) {
        edges {
          node {
            id
            title
            availableForSale
            price {
              amount
              currencyCode
            }
          }
        }
      }
    }
  }
`;

type GiftCardProductResponse = {
  product: {
    id: string;
    title: string;
    isGiftCard: boolean;
    variants: {
      edges: {
        node: {
          id: string;
          title: string;
          availableForSale: boolean;
          price: { amount: string; currencyCode: string };
        };
      }[];
    };
  } | null;
};

export type GiftCardDenomination = {
  variantId: string;
  amount: number;
  currencyCode: string;
};

export type GiftCardProduct = {
  title: string;
  denominations: GiftCardDenomination[];
};

/** The gift card product's handle in Shopify Admin (Products → Gift cards). */
export function giftCardProductHandle() {
  return process.env.SHOPIFY_GIFT_CARD_HANDLE || 'gift-card';
}

/** The purchasable gift card denominations, or null when no gift card product is published. */
export async function getGiftCardProduct(): Promise<GiftCardProduct | null> {
  if (!hasShopifyConfig()) return null;

  try {
    const { product } = await shopifyFetch<GiftCardProductResponse>({
      query: GIFT_CARD_PRODUCT_QUERY,
      variables: { handle: giftCardProductHandle() },
      cache: 'no-store',
    });
    if (!product?.isGiftCard) return null;

    const denominations = product.variants.edges
      .map(({ node }) => ({
        variantId: node.id,
        amount: Number(node.price.amount),
        currencyCode: node.price.currencyCode,
        available: node.availableForSale,
      }))
      .filter((variant) => variant.available && Number.isFinite(variant.amount))
      .map(({ variantId, amount, currencyCode }) => ({ variantId, amount, currencyCode }))
      .sort((a, b) => a.amount - b.amount);

    return denominations.length > 0 ? { title: product.title, denominations } : null;
  } catch (error) {
    console.error('Gift card product fetch failed:', error);
    return null;
  }
}

export const GIFT_CARD_MESSAGE_MAX = 200;
export const GIFT_CARD_NAME_MAX = 255;

/**
 * Cart line attributes that make Shopify email the purchased gift card to a recipient.
 * Property names are Shopify's gift card recipient properties.
 */
export function giftCardRecipientAttributes(recipient: {
  email: string;
  name?: string;
  message?: string;
}): CartLineAttribute[] {
  const attributes: CartLineAttribute[] = [
    { key: '__shopify_send_gift_card_to_recipient', value: 'true' },
    { key: 'Recipient email', value: recipient.email },
  ];
  if (recipient.name) attributes.push({ key: 'Recipient name', value: recipient.name });
  if (recipient.message) attributes.push({ key: 'Message', value: recipient.message });
  return attributes;
}
