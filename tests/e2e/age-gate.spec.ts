/** The 18+ age gate. These tests run without the fixture's pop-up suppression. */
import { expect, test } from './fixtures';

test.use({ quietPopups: false });

test('first visit shows the age gate; confirming hides it and is remembered', async ({ page, context }) => {
  await page.goto('/');
  const enter = page.getByRole('button', { name: 'I am 18 or older — Enter' });
  await expect(page.getByText('Adults Only')).toBeVisible();
  await enter.click();
  await expect(enter).toBeHidden();

  const cookie = (await context.cookies()).find((c) => c.name === 'velour_age_verified');
  expect(cookie?.value).toBe('1');

  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.getByText('Adults Only')).toBeHidden();
});

test('declining leaves the site', async ({ page }) => {
  await page.route('https://www.google.com/**', (route) => route.fulfill({ status: 200, body: 'left site' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'I am under 18 — Exit' }).click();
  await expect(page).toHaveURL(/google\.com/);
});
