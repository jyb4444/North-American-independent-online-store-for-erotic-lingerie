/** Browsing, search, product page and bag journeys. */
import type { Page } from '@playwright/test';
import { MOCK_PRODUCTS } from '@/mock/products';
import { expect, test } from './fixtures';

const PRODUCT = MOCK_PRODUCTS[0]; // Bow Satin Corset Garter Set — $39.99, S–XL, Navy Blue / Black

async function addProductToBag(page: Page, { size = 'M', color = 'Black' } = {}) {
  await page.goto(`/products/${PRODUCT.handle}`);
  await expect(page.getByRole('heading', { level: 1, name: PRODUCT.title })).toBeVisible();
  const main = page.locator('main');
  await main.getByRole('button', { name: color, exact: true }).click();
  await main.getByRole('button', { name: size, exact: true }).click();
  await main.getByRole('button', { name: 'Add to Bag' }).first().click();
}

function bag(page: Page) {
  return page.getByRole('dialog', { name: 'Shopping bag' });
}

test('header navigation leads to a collection with products', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('banner').getByRole('link', { name: 'Shop ALL' }).first().click();
  await expect(page).toHaveURL(/\/collections\/all$/);
  const productLinks = page.locator('main a[href^="/products/"]');
  await expect(productLinks.first()).toBeVisible();
  expect(await productLinks.count()).toBeGreaterThan(5);
});

test('collection sorting by price puts the cheapest / most expensive product first', async ({ page }) => {
  await page.goto('/collections/all');
  const firstProduct = () => page.locator('main a[href^="/products/"]').first().getAttribute('href');
  const byPrice = [...MOCK_PRODUCTS].sort((a, b) => a.price - b.price);
  const sort = page.locator('main select').first();

  await sort.selectOption('price-asc');
  await expect.poll(firstProduct).toBe(`/products/${byPrice[0].handle}`);
  await sort.selectOption('price-desc');
  await expect.poll(firstProduct).toBe(`/products/${byPrice.at(-1)!.handle}`);
});

test('search finds a product by name and opens it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('banner').getByRole('button', { name: 'Search' }).click();
  const input = page.getByPlaceholder('Search products, categories, styles…');
  // The modal clears and then focuses its input just after opening; type once it is ready.
  await expect(input).toBeFocused();
  await input.fill('corset');
  const result = page.getByRole('dialog', { name: 'Search' }).getByRole('link', { name: new RegExp(PRODUCT.title, 'i') }).first();
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(new RegExp(`/products/${PRODUCT.handle}$`));
});

test('search with no matches shows an empty state and Escape closes it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('banner').getByRole('button', { name: 'Search' }).click();
  const input = page.getByPlaceholder('Search products, categories, styles…');
  await expect(input).toBeFocused();
  await input.fill('zzzz-no-such-style');
  await expect(page.getByText('No results for "zzzz-no-such-style"')).toBeVisible();
  // Only results inside the search panel count, not links on the page behind it.
  await expect(page.getByRole('dialog', { name: 'Search' }).locator('a[href^="/products/"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(input).toBeHidden();
});

test('product page requires a size and colour before adding to bag', async ({ page }) => {
  await page.goto(`/products/${PRODUCT.handle}`);
  await expect(page.locator('main').getByRole('button', { name: 'Select Size & Color' })).toBeDisabled();
});

test('size guide opens and closes', async ({ page }) => {
  await page.goto(`/products/${PRODUCT.handle}`);
  await page.locator('main').getByRole('button', { name: 'Size Guide' }).click();
  await expect(page.getByRole('dialog').or(page.getByText(/bust|waist|hip/i).first())).toBeVisible();
  await page.keyboard.press('Escape');
});

test('adding to bag opens the bag with the right item, quantity and subtotal', async ({ page }) => {
  await addProductToBag(page);

  const drawer = bag(page);
  await expect(drawer.getByText(PRODUCT.title).first()).toBeVisible();
  await expect(drawer.getByText('Black / M')).toBeVisible();
  await expect(drawer.getByText('$39.99').first()).toBeVisible();

  await drawer.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(drawer.getByText('$79.98').first()).toBeVisible(); // line total and subtotal
  await expect(page.getByRole('button', { name: 'Open bag' })).toContainText('2');

  await drawer.getByRole('button', { name: 'Decrease quantity' }).click();
  await expect(drawer.getByText('$79.98')).toHaveCount(0);

  await drawer.getByRole('button', { name: 'Remove item' }).click();
  await expect(page.getByText('Your private bag is empty')).toBeVisible();
});

test('the bag survives a page reload', async ({ page }) => {
  await addProductToBag(page, { size: 'L', color: 'Navy Blue' });
  await expect(bag(page).getByText('Navy Blue / L')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Open bag' }).click();
  await expect(bag(page).getByText('Navy Blue / L')).toBeVisible();
});

test('the sale page only lists discounted products', async ({ page }) => {
  await page.goto('/sale');
  const discounted = MOCK_PRODUCTS.filter((product) => product.compareAtPrice && product.compareAtPrice > product.price);
  const links = await page.locator('main a[href^="/products/"]').evaluateAll((anchors) =>
    [...new Set(anchors.map((anchor) => anchor.getAttribute('href')))],
  );
  const allowed = new Set(discounted.map((product) => `/products/${product.handle}`));
  for (const href of links) expect(allowed.has(href!), `${href} is on /sale but not discounted`).toBe(true);
});
