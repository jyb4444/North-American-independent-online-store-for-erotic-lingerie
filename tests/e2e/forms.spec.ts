/** Contact form, gift card purchase and AI preview. */
import { MOCK_PRODUCTS } from '@/mock/products';
import { clearOutbox, readOutbox } from '../helpers/outbox';
import { GIFT_CARD_VARIANT, recordedCartCreates, resetShopifyMock } from '../helpers/shopify-mock';
import { expect, test } from './fixtures';

test('the contact form sends a message and confirms it', async ({ page }) => {
  await clearOutbox();
  // The contact API allows 3 messages per client per hour, and the API tests share this
  // server; present this browser as its own client.
  await page.route('**/api/contact', (route) =>
    route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': '203.0.113.10' } }));
  await page.goto('/pages/contact');
  const main = page.locator('main');
  await main.getByPlaceholder('Your name').fill('Contact Tester');
  await main.getByPlaceholder('your@email.com').fill('contact-e2e@test.local');
  await page.getByPlaceholder('How can we help?').fill('Do you ship to Canada?');
  await page.getByRole('button', { name: 'Send Message' }).click();
  await expect(page.getByText('We received your message and will reply to')).toBeVisible();

  const emails = await readOutbox();
  expect(emails.map((email) => email.to).sort()).toEqual(['contact-e2e@test.local', 'owner@example.com']);
});

test('buying a gift card for someone goes to Shopify checkout', async ({ page }) => {
  await resetShopifyMock();
  await page.route('https://e2e-store.myshopify.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Mock Shopify checkout</h1>' }));

  await page.goto('/pages/gift-card');
  await page.getByRole('button', { name: '$50' }).click();
  await page.getByLabel(/recipient email/i).fill('friend@test.local');
  await page.getByLabel(/recipient name/i).fill('Friend');
  await page.getByLabel(/personal message/i).fill('Enjoy!');
  await page.getByRole('button', { name: /continue to checkout · \$50/i }).click();
  await expect(page.getByRole('heading', { name: 'Mock Shopify checkout' })).toBeVisible();

  const [input] = await recordedCartCreates();
  expect(input.lines[0].merchandiseId).toBe(GIFT_CARD_VARIANT.$50);
  expect(input.lines[0].attributes).toContainEqual({ key: 'Recipient email', value: 'friend@test.local' });
});

test('AI preview explains when the service is unavailable instead of failing silently', async ({ page }) => {
  // HF_TOKEN is empty in the test environment, so the API answers 503 with an explanation.
  const res = await page.request.post('/api/ai-preview', {
    data: { productHandle: MOCK_PRODUCTS[0].handle, bodyDescription: 'a woman, size M' },
  });
  expect(res.status()).toBe(503);
  expect((await res.json()).error).toMatch(/HF_TOKEN/);
});
