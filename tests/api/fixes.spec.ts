import crypto from 'node:crypto';
/**
 * Regression tests for defects fixed after the E2E review (docs/testing/TEST_PLAN.md §0):
 * D10 cron auth, D13 login redirect, D14 welcome email, D15–D17 returns, D23 OAuth setup,
 * D24 webhook JSON, D27 SEO, D28 logo size, D32 AI preview input.
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { admin, pkceCallbackCode, sessionCookieHeader, signShopifyWebhook, TEST_PASSWORD } from '../helpers/supabase';
import { SEED, USERS, userIdFor } from '../helpers/seed';
import { clearOutbox, readOutbox } from '../helpers/outbox';

test.describe('D10 retired abandoned-cart marketing', () => {
  test('cannot be scheduled or invoked', async ({ request }) => {
    expect((await request.get('/api/cron/abandoned-cart')).status()).toBe(410);
  });
});

test.describe('durable newsletter delivery', () => {
  const email = 'newsletter-delivery@example.test';
  test.beforeEach(async () => {
    await admin().from('notification_jobs' as never).delete().like('identity', `newsletter-%:${email}%`);
    await admin().from('newsletter_subscribers' as never).delete().eq('email', email);
    await clearOutbox();
  });
  test.afterEach(async () => {
    await admin().from('notification_jobs' as never).delete().like('identity', `newsletter-%:${email}%`);
    await admin().from('newsletter_subscribers' as never).delete().eq('email', email);
  });

  test('keeps GET read-only and requires POST for legacy confirmation and unsubscribe', async ({ request }) => {
    const confirmationToken = crypto.randomBytes(24).toString('hex');
    const unsubscribeToken = crypto.randomBytes(24).toString('hex');
    const signup = await request.post('/api/newsletter', { data: { email } });
    expect(signup.status(), await signup.text()).toBe(410);
    await admin().from('newsletter_subscribers' as never).insert({
      email,
      status: 'pending',
      confirmation_token_hash: crypto.createHash('sha256').update(confirmationToken).digest('hex'),
      unsubscribe_token_hash: crypto.createHash('sha256').update(unsubscribeToken).digest('hex'),
    } as never);
    let subscriber = (await admin().from('newsletter_subscribers' as never).select('status').eq('email', email).single()).data as unknown as { status: string };
    expect(subscriber.status).toBe('pending');

    const confirmUrl = `/api/newsletter/confirm?token=${encodeURIComponent(confirmationToken)}&unsubscribe=${encodeURIComponent(unsubscribeToken)}`;
    const preview = await request.get(confirmUrl);
    expect(preview.status()).toBe(200);
    subscriber = (await admin().from('newsletter_subscribers' as never).select('status').eq('email', email).single()).data as unknown as { status: string };
    expect(subscriber.status).toBe('pending');

    const confirm = await request.post(confirmUrl, { maxRedirects: 0 });
    expect(confirm.status()).toBe(303);
    subscriber = (await admin().from('newsletter_subscribers' as never).select('status').eq('email', email).single()).data as unknown as { status: string };
    expect(subscriber.status).toBe('active');
    expect((await request.get('/api/cron/notifications', { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })).status()).toBe(200);
    expect((await readOutbox()).some((mail) => mail.to === email && mail.subject.includes('Welcome'))).toBe(false);
    const retiredJob = await admin().from('notification_jobs' as never)
      .select('status,payload,last_error').like('identity', `newsletter-welcome:${email}%`).single();
    expect(retiredJob.data).toMatchObject({
      status: 'manual_review', payload: {}, last_error: 'Newsletter delivery retired; message not sent',
    });

    const unsubscribeUrl = `/api/newsletter/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
    const unsubscribePreview = await request.get(unsubscribeUrl);
    expect(unsubscribePreview.status()).toBe(200);
    subscriber = (await admin().from('newsletter_subscribers' as never).select('status').eq('email', email).single()).data as unknown as { status: string };
    expect(subscriber.status).toBe('active');

    const unsubscribe = await request.post(unsubscribeUrl, { maxRedirects: 0 });
    expect(unsubscribe.status()).toBe(303);
    subscriber = (await admin().from('newsletter_subscribers' as never).select('status').eq('email', email).single()).data as unknown as { status: string };
    expect(subscriber.status).toBe('unsubscribed');
  });
});

test('D13 a signed-in visitor sent to /login?redirectTo= goes back to that page', async ({ request }) => {
  const res = await request.get('/login?redirectTo=%2Forders', {
    headers: { cookie: await sessionCookieHeader(USERS.alice) },
    maxRedirects: 0,
  });
  expect(res.status()).toBeGreaterThanOrEqual(300);
  expect(new URL(res.headers().location, 'http://x').pathname).toBe('/orders');

  const offsite = await request.get('/login?redirectTo=%2F%2Fevil.example', {
    headers: { cookie: await sessionCookieHeader(USERS.alice) },
    maxRedirects: 0,
  });
  expect(new URL(offsite.headers().location, 'http://localhost:3100').host).toBe('localhost:3100');
});

test('D14 the welcome email is sent once, not on every sign-in link', async ({ request, baseURL }) => {
  const email = `welcome-${Date.now()}@test.local`;
  const { data } = await admin().auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
  await clearOutbox();

  for (let i = 0; i < 2; i++) {
    const { code, cookieHeader } = await pkceCallbackCode(email, baseURL!);
    await request.get(`/auth/callback?code=${encodeURIComponent(code)}`, { headers: { cookie: cookieHeader }, maxRedirects: 0 });
  }
  const welcomes = (await readOutbox()).filter((mail) => mail.to === email && /wardrobe is ready/i.test(mail.subject));
  await admin().auth.admin.deleteUser(data.user!.id);
  expect(welcomes).toHaveLength(1);
});

test.describe('D15–D17 return requests', () => {
  let orderId: string;
  let robeId: string;
  let thongId: string;
  let cookie: string;

  async function submit(request: APIRequestContext, body: Record<string, unknown>) {
    return request.post('/api/returns', { headers: { cookie }, data: { orderId, desiredResolution: 'return_refund', reason: 'size_fit', ...body } });
  }
  const item = (orderItemId: string, quantity: unknown = 1, extra: Record<string, unknown> = {}) =>
    ({ orderItemId, quantity, itemCondition: 'unopened_tags_attached', ...extra });

  test.beforeAll(async () => {
    const { data: order } = await admin().from('orders').select('id, order_items(id, title)').eq('shopify_order_id', SEED.aliceOrderShopifyId).single();
    orderId = order!.id;
    robeId = order!.order_items.find((i: { title: string }) => i.title === 'E2E Satin Robe')!.id;
    thongId = order!.order_items.find((i: { title: string }) => i.title === 'E2E Lace Thong')!.id;
    cookie = await sessionCookieHeader(USERS.alice);
  });
  test.beforeEach(async () => {
    await admin().from('return_requests').delete().eq('order_id', orderId);
  });

  for (const quantity of [0, -1, 1.5, '2']) {
    test(`quantity ${JSON.stringify(quantity)} is rejected`, async ({ request }) => {
      const res = await submit(request, { items: [item(robeId, quantity)] });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toMatch(/whole number/);
    });
  }

  test('the same item cannot be listed twice in one request', async ({ request }) => {
    const res = await submit(request, { items: [item(robeId), item(robeId)] });
    expect(res.status()).toBe(400);
  });

  test('items already in an open request cannot be requested again; cancelling frees them', async ({ request }) => {
    expect((await submit(request, { items: [item(robeId, 2)] })).status()).toBe(200);
    const again = await submit(request, { items: [item(robeId, 1)] });
    expect(again.status()).toBe(400);
    expect((await again.json()).error).toMatch(/already part of an open request/);

    const { data: open } = await admin().from('return_requests').select('id').eq('order_id', orderId).single();
    expect((await request.post(`/api/returns/${open!.id}/cancel`, { headers: { cookie } })).status()).toBe(200);
    expect((await submit(request, { items: [item(robeId, 1)] })).status()).toBe(200);
  });

  test('concurrent return submissions claim an item only once', async ({ request }) => {
    const [first, second] = await Promise.all([
      submit(request, { items: [item(robeId, 2)] }),
      submit(request, { items: [item(robeId, 2)] }),
    ]);
    expect([first.status(), second.status()].sort()).toEqual([200, 400]);
    const { data: rows } = await admin().from('return_requests').select('id, return_request_items(id), return_request_events(id)').eq('order_id', orderId);
    expect(rows).toHaveLength(1);
    expect(rows?.[0].return_request_items).toHaveLength(1);
    expect(rows?.[0].return_request_events).toHaveLength(1);
  });

  test('atomic return RPC rolls back the request when an item insert fails', async () => {
    const aliceId = await userIdFor(USERS.alice);
    const requestNumber = `ROLLBACK-${Date.now()}`;
    const result = await admin().rpc('create_return_request_atomic', {
      p_user_id: aliceId,
      p_order_id: orderId,
      p_request_number: requestNumber,
      p_desired_resolution: 'return_refund',
      p_reason: 'size_fit',
      p_policy_notes: ['rollback test'],
      p_customer_note: null,
      p_media_urls: [],
      p_items: [{ order_item_id: robeId, quantity: 1, item_condition: 'invalid-condition', reason_detail: null }],
    });
    expect(result.error).not.toBeNull();
    const { count } = await admin().from('return_requests').select('id', { count: 'exact', head: true }).eq('request_number', requestNumber);
    expect(count).toBe(0);
  });

  test('invalid reasons are rejected and client-supplied conditions are ignored', async ({ request }) => {
    const reason = await submit(request, { reason: 'because', items: [item(robeId)] });
    const condition = await submit(request, { items: [item(robeId, 1, { itemCondition: 'pristine' })] });
    expect((await reason.json()).error).toBe('Choose a valid reason.');
    expect(condition.status()).toBe(200);
    const { data } = await admin().from('return_request_items').select('item_condition').eq('return_request_id', (await condition.json()).request.id).single();
    expect(data?.item_condition).toBe('opened_unused');
  });

  test('photos must come from the customer\'s own upload folder', async ({ request }) => {
    const bobId = await userIdFor(USERS.bob);
    const res = await submit(request, { items: [item(robeId)], mediaUrls: [`${bobId}/private.jpg`] });
    expect(res.status()).toBe(400);
  });

  test('age and policy cases are sent to merchant review instead of auto-approved or rejected', async ({ request }) => {
    const aliceId = await userIdFor(USERS.alice);
    const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
    const db = admin();
    const ids: string[] = [];
    try {
      for (const [label, deliveredDaysAgo] of [['late', 5], ['old', 40]] as const) {
        const { data: order } = await db.from('orders').insert({
          user_id: aliceId, shopify_order_id: `e2e-window-${label}-${Date.now()}`, shopify_order_number: `W${label}`,
          email: USERS.alice, processed_at: daysAgo(45),
        }).select('id').single();
        ids.push(order!.id);
        const { data: line } = await db.from('order_items').insert({
          order_id: order!.id, shopify_line_item_id: `e2e-window-${label}`, title: `Window ${label}`, quantity: 1,
        }).select('id').single();
        await db.from('shipments').insert({
          order_id: order!.id, status: 'delivered', delivered_at: daysAgo(deliveredDaysAgo), public_lookup_token: `tok-window-${label}-${Date.now()}`,
        });
        const res = await request.post('/api/returns', {
          headers: { cookie },
          data: { orderId: order!.id, desiredResolution: 'return_refund', reason: 'changed_mind', items: [item(line!.id)] },
        });
        const { request: created } = await res.json();
        expect(created.eligibility_status, `${label}: delivered ${deliveredDaysAgo} days ago`).toBe('review_required');
        expect(created.status).toBe('submitted');
      }
    } finally {
      await db.from('orders').delete().in('id', ids);
    }
  });

  test('return tracking requires a number and only accepts http(s) links', async ({ request }) => {
    expect((await submit(request, { items: [item(thongId)], reason: 'wrong_item' })).status()).toBe(200);
    const { data: created } = await admin().from('return_requests').select('id').eq('order_id', orderId).single();
    await admin().from('return_requests').update({ status: 'approved' }).eq('id', created!.id);
    const url = `/api/returns/${created!.id}/tracking`;

    const missing = await request.post(url, { headers: { cookie }, data: {} });
    expect((await missing.json()).error).toBe('Enter the return tracking number.');
    const script = await request.post(url, { headers: { cookie }, data: { trackingNumber: '1Z999', trackingUrl: 'javascript:alert(1)' } });
    expect(script.status()).toBe(400);
    const ok = await request.post(url, { headers: { cookie }, data: { trackingNumber: '1Z999', carrier: 'UPS', trackingUrl: 'https://www.ups.com/track?tracknum=1Z999' } });
    expect(ok.status()).toBe(200);
    expect((await ok.json()).request.status).toBe('customer_shipped');
  });
});

test('D23 the Shopify OAuth setup tool is off unless explicitly enabled', async ({ request }) => {
  expect((await request.get('/api/shopify/oauth/start?shop=e2e-store.myshopify.com', { maxRedirects: 0 })).status()).toBe(404);
  expect((await request.get('/api/shopify/oauth/callback?code=x&shop=e2e-store.myshopify.com&state=y&hmac=z')).status()).toBe(404);
});

test('D24 a signed webhook with malformed JSON is a 400, not a crash', async ({ request }) => {
  const body = '{"id": 1, ';
  const res = await request.post('/api/shopify/webhook', {
    headers: { 'x-shopify-shop-domain': 'e2e-store.myshopify.com', 'x-shopify-event-id': crypto.randomUUID(), 'x-shopify-topic': 'orders/create', 'x-shopify-hmac-sha256': signShopifyWebhook(body), 'content-type': 'application/json' },
    data: Buffer.from(body), // raw bytes: Playwright would re-serialize an invalid JSON string
  });
  expect(res.status()).toBe(400);
});

test('a late older order webhook cannot overwrite newer Shopify state', async ({ request }) => {
  const orderId = `stale-order-${Date.now()}`;
  const headers = (topic: string, body: string) => ({
    'content-type': 'application/json',
    'x-shopify-shop-domain': 'e2e-store.myshopify.com',
    'x-shopify-event-id': crypto.randomUUID(),
    'x-shopify-topic': topic,
    'x-shopify-hmac-sha256': signShopifyWebhook(body),
  });
  const payload = (updatedAt: string, financialStatus: string) => JSON.stringify({
    id: `gid://shopify/Order/${orderId}`,
    name: `#${orderId}`,
    email: USERS.alice,
    financial_status: financialStatus,
    fulfillment_status: null,
    total_price: '30.00',
    currency: 'USD',
    updated_at: updatedAt,
    line_items: [],
  });
  try {
    const newer = payload('2026-10-22T12:00:00Z', 'paid');
    const older = payload('2026-10-22T11:00:00Z', 'pending');
    expect((await request.post('/api/shopify/webhook', { headers: headers('orders/updated', newer), data: newer })).status()).toBe(200);
    expect((await request.post('/api/shopify/webhook', { headers: headers('orders/updated', older), data: older })).status()).toBe(200);
    const stored = await admin().from('orders').select('financial_status,shopify_updated_at').eq('shopify_order_id', orderId).single();
    expect(stored.data?.financial_status).toBe('paid');
    expect(stored.data?.shopify_updated_at).toBe('2026-10-22T12:00:00+00:00');
  } finally {
    await admin().from('orders').delete().eq('shopify_order_id', orderId);
  }
});

test('a fulfillment event cannot create a phantom shipment', async ({ request }) => {
  const eventId = crypto.randomUUID();
  const body = JSON.stringify({
    id: 987654,
    fulfillment_id: 123456,
    order_id: `gid://shopify/Order/event-only-${Date.now()}`,
    status: 'delivered',
    happened_at: new Date().toISOString(),
  });
  const before = await admin().from('shipments').select('id', { count: 'exact', head: true });
  const response = await request.post('/api/shopify/webhook', {
    headers: {
      'content-type': 'application/json',
      'x-shopify-shop-domain': 'e2e-store.myshopify.com',
      'x-shopify-event-id': eventId,
      'x-shopify-topic': 'fulfillment_events/create',
      'x-shopify-hmac-sha256': signShopifyWebhook(body),
    },
    data: body,
  });
  expect(response.status(), await response.text()).toBe(200);
  expect(await response.json()).toMatchObject({ received: true, ignored: true });
  const after = await admin().from('shipments').select('id', { count: 'exact', head: true });
  expect(after.count).toBe(before.count);
  expect((await admin().from('shopify_webhook_inbox' as never).select('event_id').eq('event_id', eventId)).data).toEqual([]);
});

test('an out-of-order fulfillment is persisted and replayed when its order arrives', async ({ request }) => {
  const orderId = `out-of-order-${Date.now()}`;
  const fulfillmentEventId = crypto.randomUUID();
  const fulfillmentBody = JSON.stringify({
    id: `gid://shopify/Fulfillment/${orderId}-f`,
    order_id: `gid://shopify/Order/${orderId}`,
    shipment_status: 'out_for_delivery',
    tracking_number: 'TRACK-E2E',
    tracking_url: 'https://example.test/track/TRACK-E2E',
  });
  const headers = (topic: string, eventId: string, body: string) => ({
    'content-type': 'application/json',
    'x-shopify-shop-domain': 'e2e-store.myshopify.com',
    'x-shopify-event-id': eventId,
    'x-shopify-topic': topic,
    'x-shopify-hmac-sha256': signShopifyWebhook(body),
  });

  try {
    await clearOutbox();
    const fulfillment = await request.post('/api/shopify/webhook', {
      headers: headers('fulfillments/create', fulfillmentEventId, fulfillmentBody), data: fulfillmentBody,
    });
    expect(fulfillment.status(), await fulfillment.text()).toBe(200);
    const pending = await admin().from('shopify_webhook_inbox' as never).select('status').eq('event_id', fulfillmentEventId).single();
    expect((pending.data as unknown as { status: string }).status).toBe('pending');

    const orderBody = JSON.stringify({
      id: `gid://shopify/Order/${orderId}`,
      name: `#${orderId}`,
      email: USERS.alice,
      financial_status: 'pending',
      total_price: '30.00',
      currency: 'USD',
      line_items: [],
    });
    const order = await request.post('/api/shopify/webhook', {
      headers: headers('orders/create', crypto.randomUUID(), orderBody), data: orderBody,
    });
    expect(order.status(), await order.text()).toBe(200);

    const storedOrder = await admin().from('orders').select('id').eq('shopify_order_id', orderId).single();
    const shipment = await admin().from('shipments').select('status').eq('order_id', storedOrder.data!.id).single();
    expect(shipment.data?.status).toBe('in_transit');
    const completed = await admin().from('shopify_webhook_inbox' as never).select('status').eq('event_id', fulfillmentEventId).single();
    expect((completed.data as unknown as { status: string }).status).toBe('complete');

    const queued = await admin().from('notification_jobs' as never).select('id,status').like('identity', 'shipment-created:%').eq('payload->>orderId', storedOrder.data!.id).single();
    expect((queued.data as unknown as { status: string }).status).toBe('pending');
    const cronHeaders = { authorization: `Bearer ${process.env.CRON_SECRET}` };
    const [firstCron, secondCron] = await Promise.all([
      request.get('/api/cron/notifications', { headers: cronHeaders }),
      request.get('/api/cron/notifications', { headers: cronHeaders }),
    ]);
    expect(firstCron.status()).toBe(200);
    expect(secondCron.status()).toBe(200);
    const shipmentEmails = (await readOutbox()).filter((mail) => mail.to === USERS.alice && mail.subject.includes(orderId));
    expect(shipmentEmails).toHaveLength(1);
  } finally {
    const storedOrder = await admin().from('orders').select('id').eq('shopify_order_id', orderId).maybeSingle();
    if (storedOrder.data?.id) {
      await admin().from('shipments').delete().eq('order_id', storedOrder.data.id);
      await admin().from('orders').delete().eq('id', storedOrder.data.id);
    }
    await admin().from('shopify_webhook_inbox' as never).delete().eq('event_id', fulfillmentEventId);
    await admin().from('notification_jobs' as never).delete().like('identity', 'shipment-created:%');
  }
});

test.describe('D32 retired AI preview', () => {
  test('cannot invoke paid inference', async ({ request }) => {
    const res = await request.post('/api/ai-preview', {
      headers: { 'x-forwarded-for': '198.51.100.50' },
      data: { productHandle: 'bow-corset-garter-set', bodyDescription: 'a tall woman with an hourglass figure, warm medium skin tone' },
    });
    expect(res.status()).toBe(410);
  });
});

test.describe('D27 search engines', () => {
  test('robots.txt keeps private pages out and points to the sitemap', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    for (const path of ['/account', '/admin', '/orders', '/returns', '/track', '/login', '/api/']) {
      expect(robots).toContain(`Disallow: ${path}`);
    }
    expect(robots).toContain('Sitemap: http://localhost:3100/sitemap.xml');
  });

  test('sitemap lists pages, collections and products', async ({ request }) => {
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('<loc>http://localhost:3100/pages/faq</loc>');
    expect(sitemap).toContain('<loc>http://localhost:3100/collections/all</loc>');
    expect(sitemap).toContain('<loc>http://localhost:3100/products/bow-corset-garter-set</loc>');
  });

  test('private pages are noindex, shop pages are not', async ({ request }) => {
    const noindex = (html: string) => /<meta name="robots" content="noindex, nofollow"/.test(html);
    expect(noindex(await (await request.get('/login')).text())).toBe(true);
    expect(noindex(await (await request.get(`/track/${SEED.aliceTrackingToken}`)).text())).toBe(true);
    expect(noindex(await (await request.get('/products/bow-corset-garter-set')).text())).toBe(false);
  });
});

test('D28 the logo used on every page and email is small', () => {
  const bytes = fs.statSync(path.resolve(__dirname, '../../public/logo.png')).size;
  expect(bytes).toBeLessThan(200_000);
});
