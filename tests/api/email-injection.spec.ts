/**
 * SEC-09 — email HTML injection / phishing relay (D09) and newsletter error handling (D22).
 * See docs/testing/TEST_PLAN.md §0 and §3.2.
 *
 * The test server writes emails to E2E_EMAIL_OUTBOX_DIR instead of sending them, so these
 * tests assert on the exact HTML a recipient would get.
 */
import { expect, test } from '@playwright/test';
import { escapeHtml, giftCardHtml, shipmentCreatedHtml } from '@/lib/email';
import { MOCK_PRODUCTS } from '@/mock/products';
import { admin, sessionCookieHeader } from '../helpers/supabase';
import { clearOutbox, readOutbox, type OutboxEmail } from '../helpers/outbox';
import { USERS, userIdFor } from '../helpers/seed';

const ATTACK_LINK = '<a href="https://evil.example/login">Verify your account</a>';
const ATTACK_SCRIPT = '<script>alert(1)</script>';
const ATTACK_IMG = '<img src=x onerror=alert(1)>';
const ATTACK_TEXT = `${ATTACK_LINK} ${ATTACK_SCRIPT} ${ATTACK_IMG}`;

/** None of the attacker's markup survives as markup. */
function expectNoInjectedMarkup(html: string) {
  expect(html).not.toContain('<a href="https://evil.example');
  expect(html).not.toContain('<script');
  expect(html).not.toContain('<img src=x');
  expect(html).not.toMatch(/(href|src)="javascript:/i);
}

function onlyEmailTo(emails: OutboxEmail[], to: string): OutboxEmail {
  const matching = emails.filter((email) => email.to === to);
  expect(matching, `expected exactly one email to ${to}`).toHaveLength(1);
  return matching[0];
}

test.beforeEach(clearOutbox);

test.describe('SEC-09 contact form', () => {
  test('the store notification escapes submitted content and has a single-line subject', async ({ request }) => {
    const res = await request.post('/api/contact', {
      data: {
        name: ATTACK_LINK,
        email: 'victim-1@test.local',
        subject: `Order help\r\nBcc: everyone@example.com ${ATTACK_SCRIPT}`,
        message: `Line one\n${ATTACK_TEXT}`,
      },
    });
    expect(res.status(), await res.text()).toBe(200);

    const notification = onlyEmailTo(await readOutbox(), process.env.CONTACT_RECIPIENT_EMAIL!);
    expectNoInjectedMarkup(notification.html);
    expect(notification.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(notification.html).toContain('Line one<br/>');
    expect(notification.subject).not.toMatch(/[\r\n]/);
    expect(notification.replyTo).toBe('victim-1@test.local');

    // The confirmation goes to an address the submitter chose: it must carry none of their content.
    const confirmation = onlyEmailTo(await readOutbox(), 'victim-1@test.local');
    expectNoInjectedMarkup(confirmation.html);
    expect(confirmation.html).not.toContain('evil.example');
    expect(confirmation.html).not.toContain('Verify your account');
  });

  test('a recipient gets at most one confirmation per day', async ({ request }) => {
    for (let i = 0; i < 2; i++) {
      const res = await request.post('/api/contact', {
        data: { name: 'Repeat', email: 'victim-2@test.local', message: `Message number ${i}` },
      });
      expect(res.status()).toBe(200);
    }

    const emails = await readOutbox();
    expect(emails.filter((email) => email.to === 'victim-2@test.local')).toHaveLength(1);
    expect(emails.filter((email) => email.to === process.env.CONTACT_RECIPIENT_EMAIL)).toHaveLength(2);
  });
});

test.describe('SEC-09 / D22 newsletter', () => {
  test('rejects invalid addresses', async ({ request }) => {
    const res = await request.post('/api/newsletter', { data: { email: 'not-an-email@' } });
    expect(res.status()).toBe(400);
    expect(await readOutbox()).toEqual([]);
  });

  test('queues one confirmation per address, however often it is submitted', async ({ request }) => {
    const email = 'subscriber@test.local';
    const db = admin();
    await db.from('notification_jobs' as never).delete().like('identity', `newsletter-confirm:${email}:%`);
    await db.from('newsletter_subscribers' as never).delete().eq('email', email);
    try {
      for (let i = 0; i < 2; i++) {
        const res = await request.post('/api/newsletter', { data: { email } });
        expect(res.status()).toBe(200);
      }
      expect(await readOutbox()).toEqual([]);
      const cron = await request.get('/api/cron/notifications', {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
      expect(cron.status(), await cron.text()).toBe(200);
      expect(onlyEmailTo(await readOutbox(), email).subject).toContain('Confirm');
    } finally {
      await db.from('notification_jobs' as never).delete().like('identity', `newsletter-confirm:${email}:%`);
      await db.from('newsletter_subscribers' as never).delete().eq('email', email);
    }
  });
});

test.describe('SEC-09 wishlist reminder', () => {
  const product = MOCK_PRODUCTS[0];

  test('uses server-side product data and ignores client-supplied title/image', async ({ request }) => {
    const res = await request.post('/api/email', {
      headers: { cookie: await sessionCookieHeader(USERS.alice) },
      data: {
        type: 'wishlist_reminder',
        productHandle: product.handle,
        productTitle: ATTACK_TEXT,
        productImage: 'javascript:alert(1)',
      },
    });
    expect(res.status(), await res.text()).toBe(200);

    const email = onlyEmailTo(await readOutbox(), USERS.alice);
    expectNoInjectedMarkup(email.html);
    expect(email.html).toContain(escapeHtml(product.title));
    expect(email.html).toContain(`/products/${product.handle}`);
  });

  test('unknown products are rejected without sending anything', async ({ request }) => {
    const res = await request.post('/api/email', {
      headers: { cookie: await sessionCookieHeader(USERS.alice) },
      data: { type: 'wishlist_reminder', productHandle: 'does-not-exist-e2e' },
    });
    expect(res.status()).toBe(404);
    expect(await readOutbox()).toEqual([]);
  });
});

test.describe('SEC-09 abandoned-cart email', () => {
  test('cart snapshot contents (user-writable) are escaped', async ({ request }) => {
    const aliceId = await userIdFor(USERS.mallory);
    const db = admin();
    await db.from('cart_snapshots').delete().eq('user_id', aliceId);
    await db.from('notification_jobs' as never).delete().like('identity', `newsletter-confirm:${USERS.mallory}:%`);
    await db.from('newsletter_subscribers' as never).delete().eq('email', USERS.mallory);
    await db.from('newsletter_subscribers' as never).insert({
      email: USERS.mallory,
      status: 'active',
      unsubscribe_token_hash: 'e2e-abandoned-cart-unsubscribe-hash',
      confirmed_at: new Date().toISOString(),
    } as never);
    await db.from('notification_jobs' as never).insert({
      kind: 'newsletter_confirmation',
      identity: `newsletter-confirm:${USERS.mallory}:e2e-abandoned-cart`,
      payload: { unsubscribeToken: 'e2e-abandoned-cart-unsubscribe-token' },
      status: 'sent',
    } as never);
    await db.from('cart_snapshots').insert({
      user_id: aliceId,
      email: USERS.mallory,
      reminder_sent: false,
      updated_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      items: [{
        variantId: 'v-e2e',
        productId: '"><script>alert(1)</script>',
        title: ATTACK_TEXT,
        image: 'javascript:alert(1)',
        price: 19.5,
        size: ATTACK_IMG,
        color: 'Black',
        colorHex: '#000',
        quantity: 1,
      }],
    });

    try {
      const res = await request.get('/api/cron/abandoned-cart', {
        headers: { 'x-cron-secret': process.env.CRON_SECRET! },
      });
      expect(res.status(), await res.text()).toBe(200);

      const email = onlyEmailTo(await readOutbox(), USERS.mallory);
      expectNoInjectedMarkup(email.html);
      expect(email.html).toContain('$19.50');
      expect(email.html).toContain('/products/%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    } finally {
      await db.from('cart_snapshots').delete().eq('user_id', aliceId);
      await db.from('notification_jobs' as never).delete().like('identity', `newsletter-confirm:${USERS.mallory}:%`);
      await db.from('newsletter_subscribers' as never).delete().eq('email', USERS.mallory);
    }
  });
});

test.describe('SEC-09 templates', () => {
  test('gift card email escapes sender, recipient and message', () => {
    const html = giftCardHtml({
      code: 'E2E1-AAAA-BBBB-CCCC',
      amount: 25,
      recipientName: ATTACK_IMG,
      senderName: ATTACK_LINK,
      message: `Enjoy!\n${ATTACK_SCRIPT}`,
      expiresAt: new Date('2027-10-10T00:00:00Z'),
    });
    expectNoInjectedMarkup(html);
    expect(html).toContain('Enjoy!<br/>&lt;script&gt;');
    expect(html).toContain('$25.00');
  });

  test('shipment email escapes carrier data and drops non-http tracking links', () => {
    const html = shipmentCreatedHtml({
      orderNumber: '1001',
      carrier: ATTACK_LINK,
      trackingNumber: ATTACK_SCRIPT,
      trackingUrl: 'javascript:alert(1)',
      lookupToken: 'tok/../x',
    });
    expectNoInjectedMarkup(html);
    expect(html).not.toContain('open tracking');
    expect(html).toContain('/track/tok%2F..%2Fx');
  });
});
