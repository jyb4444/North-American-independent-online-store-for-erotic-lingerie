import { expect, test } from '@playwright/test';
import crypto from 'node:crypto';
import { admin, sessionCookieHeader } from '../helpers/supabase';
import { USERS } from '../helpers/seed';

test('review media requires authentication, stays private, and is scoped to its owner', async ({ request }) => {
  const file = {
    name: 'review.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00]),
  };
  const anonymous = await request.post('/api/reviews/media', { multipart: { kind: 'photo', file } });
  expect(anonymous.status()).toBe(401);

  const uploaded = await request.post('/api/reviews/media', {
    headers: {
      cookie: await sessionCookieHeader(USERS.alice),
      'x-forwarded-for': `review-media-${crypto.randomUUID()}`,
    },
    multipart: { kind: 'photo', file },
  });
  expect(uploaded.status(), await uploaded.text()).toBe(201);
  const { path } = await uploaded.json() as { path: string };
  expect(path).toMatch(/^reviews\/[^/]+\/photos\/[0-9a-f-]+\.png$/);

  try {
    const direct = await request.get(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ugc/${path}`,
    );
    expect(direct.ok()).toBe(false);

    const forged = await request.post('/api/reviews', {
      headers: {
        cookie: await sessionCookieHeader(USERS.bob),
        'x-forwarded-for': `review-media-forge-${crypto.randomUUID()}`,
      },
      data: {
        product_id: 'e2e-review-media',
        product_handle: 'e2e-review-media',
        rating: 5,
        body_text: 'This review attempts to claim another account media.',
        photo_urls: [path],
      },
    });
    expect(forged.status()).toBe(400);

    const forgedDelete = await request.delete('/api/reviews/media', {
      headers: { cookie: await sessionCookieHeader(USERS.bob) },
      data: { paths: [path] },
    });
    expect(forgedDelete.status()).toBe(400);
  } finally {
    await admin().storage.from('ugc').remove([path]);
  }
});
