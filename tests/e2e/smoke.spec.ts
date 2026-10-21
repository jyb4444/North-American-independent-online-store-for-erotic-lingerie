/**
 * Site-wide smoke test: every route renders without errors, and no internal link is broken.
 * Browser console errors, uncaught exceptions and 5xx responses fail the test (see fixtures).
 */
import { MOCK_PRODUCTS } from '@/mock/products';
import { MOCK_COLLECTIONS } from '@/mock/collections';
import { isPublicCollectionHandle, isPublicProductHandle } from '@/lib/catalog-visibility';
import { USERS } from '../helpers/seed';
import { expect, signIn, test } from './fixtures';

const STATIC_PAGES = [
  '/',
  '/sale',
  '/membership',
  '/track',
  '/login',
  '/pages/about',
  '/pages/contact',
  '/pages/faq',
  '/pages/gift-card',
  '/pages/privacy',
  '/pages/referral',
  '/pages/returns',
  '/pages/shipping',
  '/pages/size-guide',
  '/pages/terms',
];

const PUBLIC_PAGES = [
  ...STATIC_PAGES,
  ...MOCK_COLLECTIONS.filter((collection) => isPublicCollectionHandle(collection.handle)).map(
    (collection) => `/collections/${collection.handle}`,
  ),
  ...MOCK_PRODUCTS.filter((product) => isPublicProductHandle(product.handle)).map(
    (product) => `/products/${product.handle}`,
  ),
];

const HIDDEN_CATALOG_PAGES = [
  '/collections/frontpage',
  '/products/fishnet-halter-bodystocking',
  '/products/half-cup-underwire-lace-bodysuit-waist-cinching-lingerie',
  '/products/leopard-jacquard-pearl-bodysuit-mesh-lingerie-set',
];

const ACCOUNT_PAGES = ['/account', '/account/profile', '/account/addresses', '/account/wishlist', '/account/orders', '/orders', '/returns'];

test.describe('public pages', () => {
  for (const path of PUBLIC_PAGES) {
    test(`renders ${path}`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status(), `HTTP status for ${path}`).toBeLessThan(400);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('h1, form').first()).toBeVisible();
      await page.waitForLoadState('networkidle');
    });
  }

  test.describe(() => {
    // The browser logs the expected 404 document as a console error; that is not a defect.
    test.use({ failOnPageIssues: false });

    test('unknown product and collection pages return 404', async ({ page }) => {
      for (const path of [
        '/products/does-not-exist-e2e',
        '/collections/does-not-exist-e2e',
        ...HIDDEN_CATALOG_PAGES,
      ]) {
        const response = await page.goto(path);
        expect(response?.status(), path).toBe(404);
        await expect(page.getByText(/not found|doesn.t exist|404/i).first()).toBeVisible();
      }
    });
  });
});

test.describe('account pages (signed in)', () => {
  for (const path of ACCOUNT_PAGES) {
    test(`renders ${path}`, async ({ page }) => {
      await signIn(page, USERS.alice);
      const response = await page.goto(path);
      expect(response?.status(), `HTTP status for ${path}`).toBeLessThan(400);
      expect(new URL(page.url()).pathname, 'should not bounce to login').not.toBe('/login');
      await expect(page.locator('h1').first()).toBeVisible();
      await page.waitForLoadState('networkidle');
    });
  }

  test('signed-out visitors are sent to login', async ({ page }) => {
    for (const path of ACCOUNT_PAGES) {
      await page.goto(path);
      expect(new URL(page.url()).pathname, path).toBe('/login');
    }
  });
});

test('no internal link on public pages is broken', async ({ request }) => {
  const links = new Set<string>();
  for (const path of PUBLIC_PAGES) {
    const html = await (await request.get(path)).text();
    for (const [, href] of html.matchAll(/<a[^>]+href="(\/[^"#]*)/g)) links.add(href.replace(/&amp;/g, '&'));
  }
  expect(links.size).toBeGreaterThan(20);

  const broken: string[] = [];
  for (const href of links) {
    const res = await request.get(href, { maxRedirects: 5 });
    if (res.status() >= 400) broken.push(`${res.status()} ${href}`);
  }
  expect(broken).toEqual([]);
});
