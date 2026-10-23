/** Mobile layout (runs in the e2e-mobile project: Pixel 7 viewport, touch). */
import { MOCK_PRODUCTS } from '@/mock/products';
import { expect, test } from './fixtures';

for (const path of ['/', '/collections/all', `/products/${MOCK_PRODUCTS[0].handle}`, '/pages/contact', '/login', '/track']) {
  test(`${path} has no horizontal scrolling`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'pixels of horizontal overflow').toBeLessThanOrEqual(1);
  });
}

test('the bottom navigation opens the bag', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Bag', exact: true }).click();
  await expect(page.getByText('Your private bag is empty')).toBeVisible();
});

test('the product page sticky bar adds to bag', async ({ page }) => {
  const product = MOCK_PRODUCTS[0];
  await page.goto(`/products/${product.handle}`);
  const main = page.locator('main');
  await main.getByRole('button', { name: 'Black', exact: true }).click();
  await main.getByRole('button', { name: 'Select size M', exact: true }).click();
  await main.getByRole('button', { name: 'Add to Bag' }).last().click();
  await expect(page.getByRole('button', { name: 'Go to checkout' })).toBeVisible();
});
