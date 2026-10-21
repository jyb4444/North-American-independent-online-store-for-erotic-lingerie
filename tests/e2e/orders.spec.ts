/** Order history, order detail, returns and package tracking. Uses Alice's seeded order #1001. */
import { admin } from '../helpers/supabase';
import { SEED, USERS } from '../helpers/seed';
import { expect, signIn, test } from './fixtures';

async function aliceOrderId() {
  const { data } = await admin().from('orders').select('id').eq('shopify_order_id', SEED.aliceOrderShopifyId).single();
  return data!.id as string;
}

test.beforeEach(async () => {
  // Each test starts without return requests on Alice's order.
  await admin().from('return_requests').delete().eq('order_id', await aliceOrderId());
});

test('order history lists the order and links to its detail page', async ({ page }) => {
  await signIn(page, USERS.alice);
  await page.goto('/orders');
  const orderLink = page.locator(`a[href="/orders/${await aliceOrderId()}"]`).first();
  await expect(orderLink).toBeVisible();
  await expect(page.getByText(/#?1001/).first()).toBeVisible();
  // Other customers' orders never appear.
  await expect(page.getByText('2001')).toHaveCount(0);

  await orderLink.click();
  await expect(page.getByRole('heading', { name: 'Order #1001' })).toBeVisible();
  await expect(page.getByText('E2E Satin Robe').first()).toBeVisible();
  await expect(page.getByText('E2E Lace Thong').first()).toBeVisible();
  await expect(page.getByText('E2ETRACK1001').first()).toBeVisible();
});

test('a return can be requested, viewed and cancelled', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept()); // "Cancel this return request?"
  await signIn(page, USERS.alice);
  await page.goto(`/orders/${await aliceOrderId()}`);

  await page.getByRole('button', { name: 'Select E2E Satin Robe' }).click();
  await page.locator('select').filter({ has: page.locator('option', { hasText: 'Quality issue' }) }).selectOption({ label: 'Size or fit' });
  await page.getByRole('button', { name: 'Submit Request' }).click();
  await expect(page.getByRole('heading', { name: 'Return Started' })).toBeVisible();

  const { data: request } = await admin()
    .from('return_requests')
    .select('id, request_number, status, eligibility_status')
    .eq('order_id', await aliceOrderId())
    .single();
  expect(request).toMatchObject({ status: 'submitted', eligibility_status: 'eligible' });
  await expect(page.getByText(request!.request_number).first()).toBeVisible();

  await page.goto('/returns');
  await page.getByText(request!.request_number).first().click();
  await expect(page).toHaveURL(new RegExp(`/returns/${request!.id}$`));
  await expect(page.getByRole('heading', { name: request!.request_number })).toBeVisible();

  await page.getByRole('button', { name: 'Cancel Request' }).click();
  await expect(page.getByText('closed').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel Request' })).toHaveCount(0);
});

test('an underwear return for a change of mind is rejected with the hygiene policy', async ({ page }) => {
  await signIn(page, USERS.alice);
  await page.goto(`/orders/${await aliceOrderId()}`);

  await page.getByRole('button', { name: 'Select E2E Lace Thong' }).click();
  await page.locator('select').filter({ has: page.locator('option', { hasText: 'Quality issue' }) }).selectOption({ label: 'Changed mind' });
  await page.getByRole('button', { name: 'Submit Request' }).click();
  await expect(page.getByRole('heading', { name: 'Return Started' })).toBeVisible();

  const { data } = await admin().from('return_requests').select('status, policy_notes').eq('order_id', await aliceOrderId()).single();
  expect(data!.status).toBe('rejected');
  expect(data!.policy_notes.join(' ')).toMatch(/final sale for hygiene/);
  await expect(page.getByText(/E2E Lace Thong: underwear\/bottom intimate items are final sale for hygiene reasons\./i)).toBeVisible();
});

test.describe('package tracking', () => {
  test('lookup by order number and email shows the shipment', async ({ page }) => {
    await page.goto('/track');
    await page.getByPlaceholder('1001').fill('#1001');
    await page.getByPlaceholder('you@example.com').fill('ALICE@test.local');
    await page.locator('main').getByRole('button', { name: 'Track' }).click();
    await expect(page.getByText('E2ETRACK1001').first()).toBeVisible();
    await expect(page.getByText(/delivered/i).first()).toBeVisible();
    // Private details are not shown on the public tracking page.
    await expect(page.getByText(USERS.alice)).toHaveCount(0);
  });

  test.describe(() => {
    // The lookup API answers 404 for unknown orders; the browser logs that response.
    test.use({ expectedConsoleErrors: [/404 \(Not Found\).*\/api\/logistics\/track/] });

    test('wrong details show a friendly error', async ({ page }) => {
    await page.goto('/track');
    await page.getByPlaceholder('1001').fill('1001');
    await page.getByPlaceholder('you@example.com').fill('someone-else@test.local');
    await page.locator('main').getByRole('button', { name: 'Track' }).click();
    await expect(page.getByText('No order found for those details.')).toBeVisible();
    });
  });

  test('the private tracking link works without signing in', async ({ page }) => {
    await page.goto(`/track/${SEED.aliceTrackingToken}`);
    await expect(page.getByText('E2ETRACK1001').first()).toBeVisible();
    await expect(page.getByText(USERS.alice)).toHaveCount(0);
  });
});
