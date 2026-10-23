import { expect, test } from '../e2e/fixtures';

test('production-default flags hide disabled marketing and paid preview features', async ({ page, request }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await expect(page.getByLabel(/Referral code/i)).toHaveCount(0);
  await expect(page.getByLabel('First Name')).toBeVisible();
  await expect(page.getByLabel('Confirm Password')).toBeVisible();

  await page.goto('/pages/referral');
  await expect(page.getByRole('heading', { name: /rewards are currently unavailable/i })).toBeVisible();
  await expect(page.getByText(/\$10|\$30/)).toHaveCount(0);
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Referral Program' })).toHaveCount(0);

  await page.evaluate(() => {
    localStorage.setItem('velour_fit_profile_v1', 'sensitive-legacy-data');
    localStorage.setItem('velour_ai_lookbook_v1', 'legacy-image');
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('velour_fit_profile_v1'))).toBeNull();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('velour_ai_lookbook_v1'))).toBeNull();

  expect((await request.post('/api/newsletter', { data: { email: 'disabled@example.com' } })).status()).toBe(410);
  expect((await request.post('/api/ai-preview', { data: { productHandle: 'anything' } })).status()).toBe(410);
});
