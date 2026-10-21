/** Sign-in, sign-up, profile, addresses, wishlist and reviews. */
import { MOCK_PRODUCTS } from '@/mock/products';
import { admin } from '../helpers/supabase';
import { USERS, userIdFor } from '../helpers/seed';
import { expect, signIn, test } from './fixtures';

const PRODUCT = MOCK_PRODUCTS[1];

test.describe('authentication', () => {
  test.describe(() => {
    test.use({ expectedConsoleErrors: [/400 \(Bad Request\).*auth\/v1\/token/] });

    test('a wrong password shows an error and stays on login', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('Email').fill(USERS.alice);
      await page.getByLabel('Password', { exact: true }).fill('wrong-password');
      await page.locator('form').getByRole('button', { name: /sign in/i }).click();
      await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe(() => {
    // Right after sign-out a component may still ask Supabase for the (now revoked) user once.
    test.use({ expectedConsoleErrors: [/403 \(Forbidden\).*auth\/v1\/user/] });

  test('signing in and out updates the header', async ({ page }) => {
    await signIn(page, USERS.alice);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

    await page.getByRole('banner').getByRole('button', { name: /alice/i }).click();
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page.getByRole('banner').getByText('Sign In')).toBeVisible();

    await page.goto('/account');
    await expect(page).toHaveURL(/\/login/);
  });

  test('signing out removes the bag from this device (shared-device privacy)', async ({ page }) => {
    await admin().from('cart_snapshots').delete().eq('user_id', await userIdFor(USERS.mallory));
    await signIn(page, USERS.mallory);
    await page.goto(`/products/${PRODUCT.handle}`);
    const main = page.locator('main');
    await main.getByRole('button', { name: PRODUCT.variants[0].color, exact: true }).click();
    await main.getByRole('button', { name: PRODUCT.variants[0].size, exact: true }).click();
    await main.getByRole('button', { name: 'Add to Bag' }).first().click();
    await expect(page.getByRole('button', { name: 'Open bag' })).toContainText('1');
    await page.keyboard.press('Escape');

    await page.goto('/account');
    await page.getByRole('banner').getByRole('button', { name: /mallory/i }).click();
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page.getByRole('banner').getByText('Sign In')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open bag' })).not.toContainText('1');
    const stored = await page.evaluate(() => localStorage.getItem('cart-storage') ?? '');
    expect(stored).not.toContain(PRODUCT.title);
  });
  });

  test('after signing in, the user returns to the page that required it', async ({ page }) => {
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Forders/);
    await page.getByLabel('Email').fill(USERS.alice);
    await page.getByLabel('Password', { exact: true }).fill('Test1234!');
    await page.locator('form').getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/orders$/, { timeout: 10_000 });
  });

  test('a new visitor can sign up', async ({ page }) => {
    const email = `signup-${Date.now()}@test.local`;
    await page.goto('/login?mode=signup');
    await page.getByLabel('First Name').fill('New');
    await page.getByLabel('Last Name').fill('Shopper');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Test1234!');
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible();

    const { data } = await admin().from('profiles').select('first_name, last_name').eq('email', email).single();
    expect(data).toEqual({ first_name: 'New', last_name: 'Shopper' });
  });
});

test.describe('profile and addresses', () => {
  test('profile name changes are saved', async ({ page }) => {
    await signIn(page, USERS.mallory);
    await page.goto('/account/profile');
    await expect(page.getByLabel('First Name')).toHaveValue(/.+/);
    await page.getByLabel('First Name').fill('Mallory');
    await page.getByLabel('Last Name').fill('E2E');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('First Name')).toHaveValue('Mallory');
    await expect(page.getByLabel('Last Name')).toHaveValue('E2E');
  });

  test('addresses can be added, made default and deleted', async ({ page }) => {
    const malloryId = await userIdFor(USERS.mallory);
    await admin().from('addresses').delete().eq('user_id', malloryId);

    await signIn(page, USERS.mallory);
    await page.goto('/account/addresses');
    await expect(page.getByText('No addresses saved')).toBeVisible();

    for (const [name, city] of [['Home Address', 'Springfield'], ['Work Address', 'Shelbyville']]) {
      await page.getByRole('button', { name: /add (new )?address/i }).first().click();
      await page.getByLabel(/^Full Name/).fill(name);
      await page.getByLabel(/^Country/).fill('US');
      await page.getByLabel(/^Address Line 1/).fill('1 Test Street');
      await page.getByLabel(/^City/).fill(city);
      await page.getByLabel(/^State/).fill('CA');
      await page.getByLabel(/^ZIP/).fill('90001');
      await page.locator('form').getByRole('button', { name: 'Add Address' }).click();
      await expect(page.getByText(name)).toBeVisible();
    }

    const work = page.locator('div', { has: page.getByText('Work Address') }).filter({ has: page.getByRole('button', { name: 'Set default' }) }).last();
    await work.getByRole('button', { name: 'Set default' }).click();
    await page.reload();
    const { data: defaults } = await admin().from('addresses').select('full_name').eq('user_id', malloryId).eq('is_default', true);
    expect(defaults).toEqual([{ full_name: 'Work Address' }]);

    const home = page.locator('div', { has: page.getByText('Home Address') }).filter({ has: page.getByTitle('Delete') }).last();
    await home.getByTitle('Delete').click();
    await expect(page.getByText('Home Address')).toBeHidden();
    const { data: remaining } = await admin().from('addresses').select('full_name').eq('user_id', malloryId);
    expect(remaining).toEqual([{ full_name: 'Work Address' }]);
  });
});

test.describe('wishlist', () => {
  test('signed-out visitors are asked to sign in', async ({ page }) => {
    await page.goto(`/products/${PRODUCT.handle}`);
    await page.locator('main').getByRole('button', { name: 'Sign in to save' }).first().click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('a saved style appears in the wishlist and can be removed', async ({ page }) => {
    const malloryId = await userIdFor(USERS.mallory);
    await admin().from('wishlists').delete().eq('user_id', malloryId);

    await signIn(page, USERS.mallory);
    await page.goto(`/products/${PRODUCT.handle}`);
    await page.locator('main').getByRole('button', { name: 'Save to wishlist' }).first().click();
    await expect(page.locator('main').getByRole('button', { name: 'Remove from wishlist' }).first()).toBeVisible();

    await page.goto('/account/wishlist');
    await expect(page.getByText(PRODUCT.title).first()).toBeVisible();
    await page.getByRole('button', { name: 'Remove from wishlist' }).first().click();
    await expect(page.getByText('Your wishlist is empty')).toBeVisible();
  });
});

test.describe('reviews', () => {
  test('signed-in shoppers can submit a review, which shows as pending', async ({ page }) => {
    await admin().from('reviews').delete().eq('product_id', PRODUCT.id);
    await signIn(page, USERS.mallory);
    await page.goto(`/products/${PRODUCT.handle}`);

    await page.getByRole('button', { name: 'Write a Review' }).click();
    await page.getByRole('button', { name: /^Rate 5/ }).click();
    await page.getByPlaceholder(/What should other shoppers know/).fill('Beautiful lace and the sizing was spot on.');
    await page.getByRole('button', { name: 'Submit Review' }).click();

    await expect(page.getByText('Beautiful lace and the sizing was spot on.')).toBeVisible();
    await expect(page.getByText('Pending approval')).toBeVisible();

    const { data } = await admin().from('reviews').select('approved, rating').eq('product_id', PRODUCT.id);
    expect(data).toEqual([{ approved: false, rating: 5 }]);
    await admin().from('reviews').delete().eq('product_id', PRODUCT.id);
  });
});
