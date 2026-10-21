/**
 * D04 / D05 — gift cards are native Shopify gift cards.
 *  - Buying one goes through Shopify checkout (no free issuance from our API).
 *  - Redeeming one passes the code to Shopify, which applies the real balance.
 * Shopify is replaced by tests/mocks/shopify-storefront.ts; these tests assert what the app
 * sends to the Storefront API and how it handles the documented responses.
 */
import { expect, test } from '@playwright/test';
import {
  GIFT_CARD_VARIANT,
  MOCK_GIFT_CARD,
  REGULAR_VARIANT,
  recordedCartCreates,
  resetShopifyMock,
} from '../helpers/shopify-mock';

test.beforeEach(resetShopifyMock);

test.describe('D04 buying a gift card', () => {
  test('the old endpoint that issued gift cards without payment is gone', async ({ request }) => {
    const issue = await request.post('/api/gift-card', {
      data: { amount: 500, recipient_email: 'me@test.local' },
    });
    const lookup = await request.get('/api/gift-card?code=ANY');
    expect(issue.status()).toBe(404);
    expect(lookup.status()).toBe(404);
  });

  test('the gift card page offers the denominations available in Shopify', async ({ request }) => {
    const html = await (await request.get('/pages/gift-card')).text();
    for (const amount of ['$25', '$50', '$100']) expect(html).toContain(amount);
    expect(html).not.toContain('$500'); // not available for sale
    expect(html).not.toContain('Custom'); // Shopify gift cards are sold in fixed denominations
  });

  test('a gift card for someone else becomes a Shopify checkout with recipient properties', async ({ request }) => {
    const res = await request.post('/api/shopify/gift-card', {
      data: {
        variantId: GIFT_CARD_VARIANT.$50,
        sendToRecipient: true,
        recipientEmail: 'friend@test.local',
        recipientName: 'Friend',
        message: 'Treat yourself ♥ — A',
      },
    });
    expect(res.status(), await res.text()).toBe(200);
    expect((await res.json()).checkoutUrl).toMatch(/^https:\/\/e2e-store\.myshopify\.com\/cart\/c\//);

    expect(await recordedCartCreates()).toEqual([{
      lines: [{
        merchandiseId: GIFT_CARD_VARIANT.$50,
        quantity: 1,
        attributes: [
          { key: '__shopify_send_gift_card_to_recipient', value: 'true' },
          { key: 'Recipient email', value: 'friend@test.local' },
          { key: 'Recipient name', value: 'Friend' },
          { key: 'Message', value: 'Treat yourself ♥ — A' },
        ],
      }],
    }]);
  });

  test('a gift card for the buyer has no recipient properties', async ({ request }) => {
    const res = await request.post('/api/shopify/gift-card', {
      data: { variantId: GIFT_CARD_VARIANT.$25, sendToRecipient: false, recipientEmail: 'ignored@test.local' },
    });
    expect(res.status()).toBe(200);
    expect(await recordedCartCreates()).toEqual([{ lines: [{ merchandiseId: GIFT_CARD_VARIANT.$25, quantity: 1 }] }]);
  });

  const invalidPurchases = [
    { name: 'a regular product variant', data: { variantId: REGULAR_VARIANT, sendToRecipient: false } },
    { name: 'an unavailable denomination', data: { variantId: GIFT_CARD_VARIANT.unavailable$500, sendToRecipient: false } },
    { name: 'an invalid recipient email', data: { variantId: GIFT_CARD_VARIANT.$25, sendToRecipient: true, recipientEmail: 'nope' } },
    { name: 'a message over 200 characters', data: { variantId: GIFT_CARD_VARIANT.$25, sendToRecipient: true, recipientEmail: 'a@test.local', message: 'x'.repeat(201) } },
  ];
  for (const { name, data } of invalidPurchases) {
    test(`rejects ${name} before calling Shopify`, async ({ request }) => {
      const res = await request.post('/api/shopify/gift-card', { data });
      expect(res.status()).toBe(400);
      expect(await recordedCartCreates()).toEqual([]);
    });
  }

  test('a recipient Shopify rejects is reported to the buyer', async ({ request }) => {
    const res = await request.post('/api/shopify/gift-card', {
      data: { variantId: GIFT_CARD_VARIANT.$25, sendToRecipient: true, recipientEmail: 'reject@test.local' },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).error).toBe('The specified gift card recipient is invalid.');
  });
});

test.describe('D05 redeeming a gift card at checkout', () => {
  test('the code is sent to Shopify and the balance comes from Shopify', async ({ request }) => {
    const res = await request.post('/api/shopify/cart', {
      data: {
        lines: [{ merchandiseId: REGULAR_VARIANT, quantity: 2 }],
        giftCardCode: ' gifte2e0000 abcd ',
      },
    });
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    expect(body.appliedGiftCards).toEqual([{
      lastCharacters: 'ABCD',
      amountUsed: { amount: '40.0', currencyCode: 'USD' },
      balance: { amount: '40.0', currencyCode: 'USD' },
    }]);
    expect(body.total).toEqual({ amount: '20.0', currencyCode: 'USD' });

    const [input] = await recordedCartCreates();
    expect(input.giftCardCodes).toEqual([MOCK_GIFT_CARD.code]);
  });

  for (const [name, code] of [['unknown', 'NOTAREALCODE1234'], ['zero-balance', MOCK_GIFT_CARD.emptyCode]]) {
    test(`an ${name} gift card blocks checkout with a clear error`, async ({ request }) => {
      const res = await request.post('/api/shopify/cart', {
        data: { lines: [{ merchandiseId: REGULAR_VARIANT, quantity: 1 }], giftCardCode: code },
      });
      expect(res.status()).toBe(422);
      const body = await res.json();
      expect(body.error).toContain('could not be applied');
      expect(body.checkoutUrl).toBeUndefined();
    });
  }

  test('checkout without a code sends no gift card codes', async ({ request }) => {
    const res = await request.post('/api/shopify/cart', { data: { lines: [{ merchandiseId: REGULAR_VARIANT, quantity: 1 }] } });
    expect(res.status()).toBe(200);
    const [input] = await recordedCartCreates();
    expect(input).not.toHaveProperty('giftCardCodes');
  });

  test('clients cannot attach line attributes (e.g. gift card recipients) to a regular checkout', async ({ request }) => {
    const res = await request.post('/api/shopify/cart', {
      data: {
        lines: [{
          merchandiseId: GIFT_CARD_VARIANT.$100,
          quantity: 1,
          attributes: [{ key: '__shopify_send_gift_card_to_recipient', value: 'true' }, { key: 'Recipient email', value: 'x@test.local' }],
        }],
      },
    });
    expect(res.status()).toBe(200);
    const [input] = await recordedCartCreates();
    expect(input.lines).toEqual([{ merchandiseId: GIFT_CARD_VARIANT.$100, quantity: 1 }]);
  });

  test('invalid quantities are rejected', async ({ request }) => {
    const zero = await request.post('/api/shopify/cart', { data: { lines: [{ merchandiseId: REGULAR_VARIANT, quantity: 0 }] } });
    const huge = await request.post('/api/shopify/cart', {
      data: { items: [{ productId: 'x', variantId: REGULAR_VARIANT, shopifyVariantId: REGULAR_VARIANT, quantity: 1000 }] },
    });
    expect(zero.status()).toBe(400);
    expect(huge.status()).toBe(400);
    expect(await recordedCartCreates()).toEqual([]);
  });

  test('checkout rejects bag items without both size and color', async ({ request }) => {
    const res = await request.post('/api/shopify/cart', {
      data: {
        items: [{
          productId: 'gid://shopify/Product/1',
          variantId: REGULAR_VARIANT,
          shopifyVariantId: REGULAR_VARIANT,
          quantity: 1,
          size: 'M',
          color: '',
        }],
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe('Choose a size and color for every item before checkout.');
    expect(await recordedCartCreates()).toEqual([]);
  });

  test('checkout identifies products that are not connected to Shopify', async ({ request }) => {
    const res = await request.post('/api/shopify/cart', {
      data: {
        items: [{
          productId: 'local-product',
          variantId: 'local-variant',
          quantity: 1,
          size: 'M',
          color: 'Black',
        }],
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('not connected to Shopify checkout');
    expect(await recordedCartCreates()).toEqual([]);
  });
});
