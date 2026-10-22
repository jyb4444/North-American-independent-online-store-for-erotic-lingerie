/**
 * D05 in the browser: the bag verifies a gift card with Shopify, shows the real balance
 * instead of a client-side "discount", and hands the code to Shopify checkout.
 */
import type { Page } from '@playwright/test';
import { MOCK_GIFT_CARD, REGULAR_VARIANT, recordedCartCreates, resetShopifyMock } from '../helpers/shopify-mock';
import { USERS } from '../helpers/seed';
import { expect, signIn, test } from './fixtures';

const CART_ITEM = {
  variantId: REGULAR_VARIANT,
  shopifyVariantId: REGULAR_VARIANT,
  productId: 'e2e-product',
  title: 'E2E Lace Set',
  image: '',
  price: 30,
  size: 'M',
  color: 'Black',
  colorHex: '#000000',
  quantity: 2,
};

async function openBagWithOneItem(page: Page) {
  await page.context().addCookies([{ name: 'velour_age_verified', value: '1', url: 'http://localhost:3100' }]);
  await page.addInitScript((item) => {
    localStorage.setItem('cart-storage', JSON.stringify({ state: { items: [item], cartOwner: 'guest' }, version: 0 }));
    localStorage.setItem('velour_cookie_consent_v1', 'denied');
    localStorage.setItem('velour_newsletter_dismissed', '1');
    localStorage.setItem('velour_first_free_offer_v1', JSON.stringify({ dismissedAt: new Date().toISOString() }));
  }, CART_ITEM);

  await page.goto('/');
  await page.getByRole('button', { name: 'Open bag' }).click();
  await expect(page.getByRole('textbox', { name: 'Gift card code' })).toBeVisible();
}

test.beforeEach(resetShopifyMock);

test('a signed-in checkout is bound to the verified site-account email', async ({ page }) => {
  await signIn(page, USERS.alice);

  const res = await page.request.post('/api/shopify/cart', { data: { items: [CART_ITEM] } });
  expect(res.status(), await res.text()).toBe(200);

  const [input] = await recordedCartCreates();
  expect(input.buyerIdentity).toEqual({ email: USERS.alice });
});

test('a valid gift card shows the Shopify balance and is passed to checkout', async ({ page }) => {
  await openBagWithOneItem(page);

  await page.getByRole('textbox', { name: 'Gift card code' }).fill(MOCK_GIFT_CARD.code.toLowerCase());
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(page.getByText('••••ABCD')).toBeVisible();
  await expect(page.getByText('Balance $40.00 · deducted at checkout')).toBeVisible();
  // No client-computed "Total" after a fake deduction any more.
  await expect(page.getByText('$20.00')).toHaveCount(0);

  // Stop at the Shopify checkout URL instead of leaving the site.
  let checkoutUrl = '';
  await page.route('https://e2e-store.myshopify.com/**', (route) => {
    checkoutUrl = route.request().url();
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Mock Shopify checkout</h1>' });
  });
  await page.getByRole('button', { name: 'Go to checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Mock Shopify checkout' })).toBeVisible();
  expect(checkoutUrl).toMatch(/^https:\/\/e2e-store\.myshopify\.com\/cart\/c\//);

  const creates = await recordedCartCreates();
  expect(creates.at(-1)?.giftCardCodes).toEqual([MOCK_GIFT_CARD.code]);
});

test.describe(() => {
  test.use({ expectedConsoleErrors: [/422 \(Unprocessable Entity\).*\/api\/shopify\/cart/] });

  test('an invalid gift card is rejected with a message and nothing is applied', async ({ page }) => {
    await openBagWithOneItem(page);

    await page.getByRole('textbox', { name: 'Gift card code' }).fill('NOT-A-REAL-CODE');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page.getByText(/could not be applied/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove gift card' })).toHaveCount(0);
  });
});
