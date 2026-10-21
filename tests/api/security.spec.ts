import crypto from 'node:crypto';
/**
 * SEC-01 … SEC-08 — database permission (RLS) and auth-boundary tests.
 * See docs/testing/TEST_PLAN.md §0 and §3.2.
 *
 * Every test asserts the SECURE behaviour; "control" tests prove the legitimate feature
 * behind each locked-down path still works. Mark newly found, not-yet-fixed defects with
 * knownDefect() from ../helpers/known-defect.
 */
import { expect, test } from '@playwright/test';
import { admin, anon, asUser, pkceCallbackCode, sessionCookieHeader, signShopifyWebhook, TEST_PASSWORD } from '../helpers/supabase';
import { SEED, USERS, userIdFor } from '../helpers/seed';

let aliceId: string;
let bobId: string;
let malloryId: string;

test.beforeAll(async () => {
  [aliceId, bobId, malloryId] = await Promise.all([
    userIdFor(USERS.alice),
    userIdFor(USERS.bob),
    userIdFor(USERS.mallory),
  ]);
});

// ─── SEC-01 ──────────────────────────────────────────────────────────────────
test.describe('SEC-01 gift cards', () => {
  test('anonymous visitors cannot list gift cards with the public anon key', async () => {

    const { data } = await anon().from('gift_cards').select('code, balance, recipient_email');
    expect(data ?? [], 'gift card codes/balances are exposed to anonymous users').toEqual([]);
  });

  test('signed-in users cannot list other people\'s gift cards', async () => {

    const alice = await asUser(USERS.alice);
    const { data } = await alice.from('gift_cards').select('code').eq('code', SEED.giftCardCode);
    expect(data ?? []).toEqual([]);
  });
});

// ─── SEC-02 ──────────────────────────────────────────────────────────────────
test.describe('SEC-02 membership tier', () => {
  async function resetMembership() {
    await admin().from('memberships').update({ tier: 'bronze', points: 0, total_spent: 0 }).eq('user_id', aliceId);
  }

  async function aliceMembership() {
    const { data } = await admin().from('memberships').select('tier, points, total_spent').eq('user_id', aliceId).single();
    return data;
  }

  test.beforeEach(resetMembership);
  test.afterAll(resetMembership);

  test('a user cannot raise their own tier/points by writing to the table directly', async () => {

    const alice = await asUser(USERS.alice);
    await alice.from('memberships').update({ tier: 'gold', points: 999_999, total_spent: 10_000 }).eq('user_id', aliceId);

    expect(await aliceMembership()).toEqual({ tier: 'bronze', points: 0, total_spent: 0 });
  });

  test('POST /api/membership cannot be used to set points or spend', async ({ request }) => {

    await request.post('/api/membership', {
      headers: { cookie: await sessionCookieHeader(USERS.alice) },
      data: { points: 999_999, total_spent: 10_000 },
    });

    expect(await aliceMembership()).toEqual({ tier: 'bronze', points: 0, total_spent: 0 });
  });

  test('control: a user can still read their own membership', async ({ request }) => {
    const res = await request.get('/api/membership', { headers: { cookie: await sessionCookieHeader(USERS.alice) } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ tier: 'bronze', points: 0 });
  });

  test('GET /api/membership requires sign-in', async ({ request }) => {
    const res = await request.get('/api/membership');
    expect(res.status()).toBe(401);
  });
});

// ─── SEC-03 ──────────────────────────────────────────────────────────────────
test.describe('SEC-03 review moderation', () => {
  test('a user cannot insert a pre-approved review impersonating someone else', async () => {

    const alice = await asUser(USERS.alice);
    const { data: inserted, error } = await alice
      .from('reviews')
      .insert({
        product_id: SEED.productId,
        product_handle: 'e2e-product',
        rating: 5,
        body: 'Forged five-star review that skipped moderation',
        nickname: 'Verified Bob',
        email: USERS.bob,
        user_id: bobId,
        approved: true,
        verified_purchase: true,
      })
      .select('id')
      .single();

    // Secure outcomes: the insert is rejected, or the server-controlled fields are forced back.
    if (error) return;
    const { data: stored } = await admin()
      .from('reviews')
      .select('approved, verified_purchase, user_id')
      .eq('id', inserted!.id)
      .single();
    await admin().from('reviews').delete().eq('id', inserted!.id);
    expect(stored).toEqual({ approved: false, verified_purchase: false, user_id: aliceId });
  });

  test('control: a signed-in user can still submit a review through the API, pending moderation', async ({ request }) => {
    const res = await request.post('/api/reviews', {
      headers: { cookie: await sessionCookieHeader(USERS.alice) },
      data: { product_id: SEED.productId, product_handle: 'e2e-product', rating: 4, body_text: 'Lovely fabric, true to size.' },
    });
    expect(res.status(), await res.text()).toBe(200);
    const { review } = await res.json();
    expect(review).toMatchObject({ pending: true, rating: 4 });

    const { data: stored } = await admin()
      .from('reviews')
      .select('approved, verified_purchase, user_id, nickname')
      .eq('id', review.id)
      .single();
    await admin().from('reviews').delete().eq('id', review.id);
    expect(stored).toEqual({ approved: false, verified_purchase: false, user_id: aliceId, nickname: 'ali***@test.local' });
  });

  test('anonymous visitors cannot insert reviews', async () => {
    const { error } = await anon().from('reviews').insert({
      product_id: SEED.productId,
      product_handle: 'e2e-product',
      rating: 5,
      body: 'Anonymous review attempt',
      nickname: 'anon',
      email: 'anon@test.local',
    });
    expect(error).not.toBeNull();
  });
});

// ─── SEC-04 ──────────────────────────────────────────────────────────────────
test.describe('SEC-04 cross-user reads', () => {
  const ownedByUserId = [
    'profiles',
    'memberships',
    'addresses',
    'wishlists',
    'cart_snapshots',
    'orders',
    'return_requests',
    'reviews',
  ] as const;

  for (const table of ownedByUserId) {
    test(`Alice cannot read Bob's rows in ${table}`, async () => {
      const alice = await asUser(USERS.alice);
      const column = table === 'profiles' ? 'id' : 'user_id';
      // Approved reviews are public by design; only pending ones are private.
      const scope = <Q extends { eq: (column: string, value: unknown) => Q }>(query: Q) =>
        table === 'reviews' ? query.eq('approved', false) : query;
      const { data: leaked } = await scope(alice.from(table).select('*').eq(column, bobId));

      // Guard against a vacuous pass: the row must really exist.
      const { data: truth } = await scope(admin().from(table).select('*').eq(column, bobId));
      expect(truth?.length ?? 0, `seed data missing for ${table}`).toBeGreaterThan(0);

      expect(leaked ?? []).toEqual([]);
    });
  }

  test('Alice cannot read Bob\'s referral', async () => {
    const alice = await asUser(USERS.alice);
    const { data } = await alice.from('referrals').select('*').eq('referrer_id', bobId);
    expect(data ?? []).toEqual([]);
  });

  test('Alice cannot read Bob\'s order items or return items through joins', async () => {
    const db = admin();
    const { data: bobOrder } = await db.from('orders').select('id').eq('shopify_order_id', SEED.bobOrderShopifyId).single();
    const { data: bobReturn } = await db.from('return_requests').select('id').eq('order_id', bobOrder!.id).single();

    const alice = await asUser(USERS.alice);
    const { data: items } = await alice.from('order_items').select('id').eq('order_id', bobOrder!.id);
    const { data: returnItems } = await alice.from('return_request_items').select('id').eq('return_request_id', bobReturn!.id);
    expect(items ?? []).toEqual([]);
    expect(returnItems ?? []).toEqual([]);
  });

  test('anonymous visitors cannot read reviewers\' private email/phone on approved reviews', async () => {

    const { data } = await anon().from('reviews').select('email').eq('product_id', SEED.productId).eq('approved', true);
    expect((data ?? []).filter((review) => review.email)).toEqual([]);
  });

  test('control: the public reviews API still returns approved reviews, without contact details', async ({ request }) => {
    const res = await request.get(`/api/reviews?product_id=${SEED.productId}`);
    expect(res.status()).toBe(200);
    const { reviews } = await res.json();
    expect(reviews.map((review: { body: string }) => review.body)).toContain('Bob public approved review text');
    for (const review of reviews) expect(review).not.toHaveProperty('email');
  });

  test('anonymous visitors cannot read orders, shipments or addresses', async () => {
    const client = anon();
    for (const table of ['orders', 'shipments', 'addresses', 'profiles', 'cart_snapshots'] as const) {
      const { data } = await client.from(table).select('*').limit(5);
      expect(data ?? [], table).toEqual([]);
    }
  });
});

// ─── SEC-05 ──────────────────────────────────────────────────────────────────
test.describe('SEC-05 cross-user writes', () => {
  test('Alice cannot update or delete Bob\'s address', async () => {
    const alice = await asUser(USERS.alice);
    await alice.from('addresses').update({ city: 'HACKED' }).eq('user_id', bobId);
    await alice.from('addresses').delete().eq('user_id', bobId);

    const { data } = await admin().from('addresses').select('city').eq('user_id', bobId);
    expect(data).toEqual([{ city: 'Bobville' }]);
  });

  test('Alice cannot create rows owned by Bob', async () => {
    const alice = await asUser(USERS.alice);
    const attempts = await Promise.all([
      alice.from('addresses').insert({
        user_id: bobId, full_name: 'x', address_line1: 'x', city: 'x', state: 'x', zip: 'x',
      }),
      alice.from('wishlists').insert({
        user_id: bobId, product_id: 'e2e-forged', product_handle: 'x', product_title: 'x',
      }),
      alice.from('referrals').insert({ referrer_id: bobId, code: 'SL-FORGEDE2E-0001' }),
    ]);
    for (const { error } of attempts) expect(error).not.toBeNull();
  });

  test('Alice cannot overwrite Bob\'s cart snapshot or wishlist', async () => {
    const alice = await asUser(USERS.alice);
    await alice.from('cart_snapshots').update({ email: 'attacker@test.local', items: [] }).eq('user_id', bobId);
    await alice.from('wishlists').delete().eq('user_id', bobId);

    const db = admin();
    const { data: cart } = await db.from('cart_snapshots').select('email').eq('user_id', bobId).single();
    const { data: wishlist } = await db.from('wishlists').select('id').eq('user_id', bobId);
    expect(cart?.email).toBe(USERS.bob);
    expect(wishlist).toHaveLength(1);
  });

  test('Alice cannot change Bob\'s profile or membership', async () => {
    const alice = await asUser(USERS.alice);
    await alice.from('profiles').update({ first_name: 'HACKED' }).eq('id', bobId);
    await alice.from('memberships').update({ tier: 'gold' }).eq('user_id', bobId);

    const db = admin();
    const { data: profile } = await db.from('profiles').select('first_name').eq('id', bobId).single();
    const { data: membership } = await db.from('memberships').select('tier').eq('user_id', bobId).single();
    expect(profile?.first_name).not.toBe('HACKED');
    expect(membership?.tier).toBe('bronze');
  });

  test('users cannot write orders or return requests directly', async () => {
    const alice = await asUser(USERS.alice);
    const { error: orderError } = await alice.from('orders').insert({
      user_id: aliceId, shopify_order_id: 'e2e-forged-order', shopify_order_number: '9999', email: USERS.alice,
    });
    const { data: bobOrder } = await admin().from('orders').select('id').eq('shopify_order_id', SEED.bobOrderShopifyId).single();
    await alice.from('return_requests').update({ status: 'refunded' }).eq('order_id', bobOrder!.id);

    expect(orderError).not.toBeNull();
    const { data: request } = await admin().from('return_requests').select('status').eq('order_id', bobOrder!.id).single();
    expect(request?.status).toBe('submitted');
  });
});

// ─── SEC-06 ──────────────────────────────────────────────────────────────────
test.describe('SEC-06 /auth/callback redirect target', () => {
  async function callbackLocation(baseURL: string, request: import('@playwright/test').APIRequestContext, next: string) {
    const { code, cookieHeader } = await pkceCallbackCode(USERS.alice, baseURL);
    const res = await request.get(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`, {
      headers: { cookie: cookieHeader },
      maxRedirects: 0,
    });
    expect(res.status(), 'callback should redirect').toBeGreaterThanOrEqual(300);
    expect(res.status()).toBeLessThan(400);
    return new URL(res.headers().location, baseURL);
  }

  test('control: a relative next path is honoured after a real sign-in', async ({ request, baseURL }) => {
    const location = await callbackLocation(baseURL!, request, '/orders');
    expect(location.search, 'code exchange failed — the harness, not the app, is broken').not.toContain('auth_callback_failed');
    expect(location.host).toBe(new URL(baseURL!).host);
    expect(location.pathname).toBe('/orders');
  });

  for (const next of ['@evil.example', '.evil.example']) {
    test(`next=${next} must not redirect off-site`, async ({ request, baseURL }) => {

      const location = await callbackLocation(baseURL!, request, next);
      expect(location.host).toBe(new URL(baseURL!).host);
    });
  }
});

// ─── SEC-07 ──────────────────────────────────────────────────────────────────
test.describe('SEC-07 order ownership', () => {
  async function sendOrderWebhook(request: import('@playwright/test').APIRequestContext, email: string) {
    const shopifyOrderId = `e2e-wh-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const body = JSON.stringify({
      id: shopifyOrderId,
      name: `#${Math.floor(Math.random() * 90_000) + 10_000}`,
      email,
      phone: '+1 555 0199',
      financial_status: 'paid',
      total_price: '42.00',
      currency: 'USD',
      line_items: [{ id: `${shopifyOrderId}-li`, title: 'Lace Thong', quantity: 1, price: '42.00' }],
    });
    const res = await request.post('/api/shopify/webhook', {
      headers: {
        'content-type': 'application/json',
        'x-shopify-shop-domain': 'e2e-store.myshopify.com', 'x-shopify-event-id': crypto.randomUUID(), 'x-shopify-topic': 'orders/create',
        'x-shopify-hmac-sha256': signShopifyWebhook(body),
      },
      data: body,
    });
    expect(res.status(), await res.text()).toBe(200);

    const { data } = await admin().from('orders').select('user_id').eq('shopify_order_id', shopifyOrderId).single();
    return data?.user_id ?? null;
  }

  test('control: webhook links an order to the account with that verified email', async ({ request }) => {
    expect(await sendOrderWebhook(request, 'ALICE@test.local')).toBe(aliceId);
  });

  test('webhook rejects requests with a bad signature', async ({ request }) => {
    const res = await request.post('/api/shopify/webhook', {
      headers: { 'x-shopify-shop-domain': 'e2e-store.myshopify.com', 'x-shopify-event-id': crypto.randomUUID(), 'x-shopify-topic': 'orders/create', 'x-shopify-hmac-sha256': 'bogus' },
      data: '{}',
    });
    expect(res.status()).toBe(401);
  });

  test('control: a user can still edit their display name', async () => {
    const mallory = await asUser(USERS.mallory);
    const { error } = await mallory.from('profiles').update({ first_name: 'Mal', last_name: 'Lory' }).eq('id', malloryId);
    expect(error).toBeNull();

    const { data } = await admin().from('profiles').select('first_name, last_name').eq('id', malloryId).single();
    expect(data).toEqual({ first_name: 'Mal', last_name: 'Lory' });
  });

  test('a user cannot change the email stored on their profile', async () => {

    const mallory = await asUser(USERS.mallory);
    await mallory.from('profiles').update({ email: 'victim-guest@test.local' }).eq('id', malloryId);

    const { data } = await admin().from('profiles').select('email').eq('id', malloryId).single();
    expect(data?.email).toBe(USERS.mallory);
  });

  test('a guest order is not assigned to a user who spoofed their profile email', async ({ request }) => {

    const mallory = await asUser(USERS.mallory);
    await mallory.from('profiles').update({ email: 'victim-guest@test.local' }).eq('id', malloryId);

    expect(await sendOrderWebhook(request, 'victim-guest@test.local')).not.toBe(malloryId);
  });

  test('order emails are matched literally, not as ILIKE patterns', async ({ request }) => {

    // No account exists for a_b@test.local, but `_` matches the "x" in axb@test.local.
    expect(await sendOrderWebhook(request, 'a_b@test.local')).toBeNull();
  });
});

// ─── SEC-08 ──────────────────────────────────────────────────────────────────
test.describe('SEC-08 referral codes', () => {
  async function bobReferralUses() {
    const { data } = await admin().from('referrals').select('uses').eq('code', SEED.bobReferralCode).single();
    return data?.uses;
  }

  test.afterAll(async () => {
    await admin().from('referrals').update({ uses: 0 }).eq('code', SEED.bobReferralCode);
    await admin().from('referrals').delete().eq('referrer_id', aliceId);
  });

  test('an anonymous caller cannot inflate a referral code\'s use count', async ({ request }) => {

    const before = await bobReferralUses();
    for (let i = 0; i < 20; i++) {
      await request.post('/api/referral', { data: { code: SEED.bobReferralCode } });
    }
    expect(await bobReferralUses()).toBe(before);
  });

  test('a user cannot create their own referral with preset uses/rewards', async () => {

    const alice = await asUser(USERS.alice);
    const { error } = await alice
      .from('referrals')
      .insert({ referrer_id: aliceId, code: 'SL-ALICEE2E-HACK', uses: 999, rewards_earned: 999 });

    if (error) return;
    const { data } = await admin().from('referrals').select('uses, rewards_earned').eq('referrer_id', aliceId).single();
    expect(data).toEqual({ uses: 0, rewards_earned: 0 });
  });

  test('control: GET /api/referral still creates a code for the signed-in user, starting at zero', async ({ request }) => {
    const headers = { cookie: await sessionCookieHeader(USERS.alice) };
    const first = await request.get('/api/referral', { headers });
    expect(first.status()).toBe(200);
    const created = await first.json();
    expect(created).toMatchObject({ uses: 0, rewards_earned: 0 });
    expect(created.code).toMatch(/^SL-[A-Z0-9]{6}-[A-Z0-9]{4}$/);

    const second = await (await request.get('/api/referral', { headers })).json();
    expect(second.code).toBe(created.code);
  });

  test('control: a confirmed new account credits the referral exactly once', async ({ request, baseURL }) => {
    await admin().from('referrals').update({ uses: 0 }).eq('code', SEED.bobReferralCode);
    const { data: created, error } = await admin().auth.admin.createUser({
      email: USERS.newbie,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { referral_code: SEED.bobReferralCode.toLowerCase() },
    });
    expect(error).toBeNull();

    for (let i = 0; i < 2; i++) {
      const { code, cookieHeader } = await pkceCallbackCode(USERS.newbie, baseURL!);
      const res = await request.get(`/auth/callback?code=${encodeURIComponent(code)}`, {
        headers: { cookie: cookieHeader },
        maxRedirects: 0,
      });
      expect(res.headers().location).not.toContain('auth_callback_failed');
    }
    await admin().auth.admin.deleteUser(created.user!.id);

    expect(await bobReferralUses()).toBe(1);
  });

  test('a user cannot redeem their own referral code', async ({ request, baseURL }) => {
    await admin().from('referrals').update({ uses: 0 }).eq('code', SEED.bobReferralCode);
    await admin().auth.admin.updateUserById(bobId, { user_metadata: { referral_code: SEED.bobReferralCode } });

    const { code, cookieHeader } = await pkceCallbackCode(USERS.bob, baseURL!);
    await request.get(`/auth/callback?code=${encodeURIComponent(code)}`, { headers: { cookie: cookieHeader }, maxRedirects: 0 });

    expect(await bobReferralUses()).toBe(0);
  });

  test('GET /api/referral requires sign-in', async ({ request }) => {
    const res = await request.get('/api/referral');
    expect(res.status()).toBe(401);
  });
});
