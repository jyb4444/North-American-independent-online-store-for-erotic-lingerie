/**
 * Browser regression tests for fixes made after the E2E review (docs/testing/TEST_PLAN.md):
 * D11 bag kept through checkout, D18 real ratings, D20 live catalogue in search,
 * D25 server-rendered age gate, D30 pop-up order, D26 privacy policy accuracy, D40 referral page.
 */
import type { Page } from '@playwright/test';
import { MOCK_PRODUCTS } from '@/mock/products';
import { admin } from '../helpers/supabase';
import { completeShopifyCart, resetShopifyMock, REGULAR_VARIANT } from '../helpers/shopify-mock';
import { expect, signIn, test } from './fixtures';

const BAG_ITEM = {
  variantId: REGULAR_VARIANT,
  shopifyVariantId: REGULAR_VARIANT,
  productId: MOCK_PRODUCTS[0].id,
  title: 'E2E Bag Item',
  image: '',
  price: 30,
  size: 'M',
  color: 'Black',
  colorHex: '#000000',
  quantity: 1,
};

async function startWithBag(page: Page) {
  await page.addInitScript((item) => {
    if (!sessionStorage.getItem('e2e-bag-seeded')) {
      localStorage.setItem('cart-storage', JSON.stringify({ state: { items: [item] }, version: 0 }));
      sessionStorage.setItem('e2e-bag-seeded', '1');
    }
  }, BAG_ITEM);
}

test.describe('D11 the bag survives an unfinished checkout', () => {
  test.beforeEach(resetShopifyMock);

  async function goToCheckout(page: Page): Promise<string> {
    let cartId = '';
    await page.route('https://e2e-store.myshopify.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Mock Shopify checkout</h1>' }));
    await page.route('**/api/shopify/cart', async (route) => {
      const response = await route.fetch();
      cartId = (await response.json()).cartId ?? '';
      await route.fulfill({ response });
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Open bag' }).click();
    await page.getByRole('button', { name: 'Go to checkout' }).click();
    await expect(page.getByRole('heading', { name: 'Mock Shopify checkout' })).toBeVisible();
    expect(cartId).toMatch(/^gid:\/\/shopify\/Cart\//);
    return cartId;
  }

  test('coming back without paying keeps the bag', async ({ page }) => {
    await startWithBag(page);
    await goToCheckout(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Open bag' }).click();
    await expect(page.getByRole('dialog', { name: 'Shopping bag' }).getByText('E2E Bag Item')).toBeVisible();
  });

  test('once Shopify turns the cart into an order, the bag is emptied', async ({ page }) => {
    await startWithBag(page);
    const cartId = await goToCheckout(page);
    await completeShopifyCart(cartId);
    await page.goto('/');
    await page.getByRole('button', { name: 'Open bag' }).click();
    await expect(page.getByText('Your private bag is empty')).toBeVisible();
  });
});

test.describe('D18 ratings come from real reviews', () => {
  const product = MOCK_PRODUCTS[2];

  test.beforeEach(async () => {
    await admin().from('reviews').delete().eq('product_id', product.id);
  });
  test.afterAll(async () => {
    await admin().from('reviews').delete().eq('product_id', product.id);
  });

  test('a product without reviews says so instead of showing a made-up rating', async ({ page }) => {
    await page.goto(`/products/${product.handle}`);
    await expect(page.locator('main').getByText('No reviews yet').first()).toBeVisible();
    await expect(page.locator('main').getByText(/\(\d+ reviews?\)/)).toHaveCount(0);
  });

  test('approved reviews drive the rating shown at the top of the page', async ({ page }) => {
    await admin().from('reviews').insert([4, 5].map((rating) => ({
      product_id: product.id, product_handle: product.handle, rating, approved: true,
      body: `Approved e2e review rated ${rating}`, nickname: 'e2e', email: 'e2e@test.local',
    })));
    await page.goto(`/products/${product.handle}`);
    await expect(page.locator('main').getByText('4.5 (2 reviews)')).toBeVisible();
  });
});

test('D20 search uses the live catalogue, not the built-in sample data', async ({ page }) => {
  const liveOnly = { ...MOCK_PRODUCTS[0], id: 'gid://shopify/Product/e2e-live', handle: 'e2e-live-only-style', title: 'Velvet Midnight Live Robe' };
  await page.route('**/api/catalog', (route) => route.fulfill({ json: { products: [liveOnly] } }));

  await page.goto('/');
  await page.getByRole('banner').getByRole('button', { name: 'Search' }).click();
  const input = page.getByRole('dialog', { name: 'Search' }).getByRole('textbox');
  await expect(input).toBeFocused();
  await input.fill('midnight');
  await expect(page.getByRole('dialog', { name: 'Search' }).getByRole('link', { name: /Velvet Midnight Live Robe/ })).toBeVisible();
  await input.fill(MOCK_PRODUCTS[1].title.split(' ')[0]);
  await expect(page.getByText(`No results for "${MOCK_PRODUCTS[1].title.split(' ')[0]}"`)).toBeVisible();
});

test.describe('D25 / D30 age gate and pop-ups', () => {
  test.use({ quietPopups: false });

  test('the age gate is in the server HTML, so it shows even without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('http://localhost:3100/products/bow-corset-garter-set');
    await expect(page.getByRole('dialog', { name: 'Adults Only' })).toBeVisible();
    await context.close();
  });

  test('verified visitors never see the gate, not even for a moment', async ({ page, context }) => {
    await context.addCookies([{ name: 'velour_age_verified', value: '1', url: 'http://localhost:3100' }]);
    // Check right after the HTML is parsed, before React hydrates and could hide it.
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const display = await page.evaluate(() => {
      const gate = document.querySelector('.age-gate');
      return gate ? getComputedStyle(gate).display : 'removed';
    });
    expect(['none', 'removed']).toContain(display);
  });

  test('the first-order offer waits until the age gate is passed', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('dialog', { name: 'Adults Only' })).toBeVisible();
    await page.waitForTimeout(2_500);
    await expect(page.getByRole('button', { name: 'Close first free offer' })).toHaveCount(0);

    await page.getByRole('button', { name: 'I am 18 or older — Enter' }).click();
    await expect(page.getByRole('button', { name: 'Close first free offer' })).toBeVisible({ timeout: 5_000 });
  });
});

test('D26 the privacy policy discloses the AI preview provider', async ({ page }) => {
  await page.goto('/pages/privacy');
  await expect(page.getByText(/Hugging Face/).first()).toBeVisible();
  await expect(page.getByText(/not shared with third parties/)).toHaveCount(0);
});

test('D40 the referral page shares a working sign-up link and lists reward codes', async ({ page, context }) => {
  const bobId = (await admin().from('referrals').select('referrer_id').eq('code', 'SL-BOBE2E-0001').single()).data!.referrer_id;
  await admin().from('referral_rewards').delete().eq('user_id', bobId);
  await admin().from('referral_rewards').insert({
    user_id: bobId, referred_user_id: bobId, kind: 'referrer', code: 'SLTHANKS-E2EBROWSER', amount: 10, minimum_subtotal: 30, status: 'issued',
  });
  try {
    await signIn(page, 'bob@test.local');
    await page.goto('/pages/referral');
    await expect(page.getByText('SLTHANKS-E2EBROWSER')).toBeVisible();
    const link = await page.locator('main p.font-mono').first().textContent();
    expect(link).toBe('http://localhost:3100/login?ref=SL-BOBE2E-0001');

    // The shared link opens sign-up with the code filled in.
    const visitor = await context.browser()!.newPage();
    await visitor.context().addCookies([{ name: 'velour_age_verified', value: '1', url: 'http://localhost:3100' }]);
    await visitor.goto(link!);
    await expect(visitor.getByLabel(/Referral Code/)).toHaveValue('SL-BOBE2E-0001');
    await visitor.close();
  } finally {
    await admin().from('referral_rewards').delete().eq('user_id', bobId);
  }
});
