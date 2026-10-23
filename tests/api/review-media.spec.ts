import { expect, test } from '@playwright/test';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { admin, sessionCookieHeader } from '../helpers/supabase';
import { USERS } from '../helpers/seed';

test('review media requires authentication, stays private, and is scoped to its owner', async ({ request }) => {
  const file = {
    name: 'review.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00]),
  };
  const metadata = { action: 'prepare', kind: 'photo', contentType: file.mimeType, size: file.buffer.length };
  const anonymous = await request.post('/api/reviews/media', { data: metadata });
  expect(anonymous.status()).toBe(401);

  const uploaded = await request.post('/api/reviews/media', {
    headers: {
      cookie: await sessionCookieHeader(USERS.alice),
      'x-forwarded-for': `review-media-${crypto.randomUUID()}`,
    },
    data: metadata,
  });
  expect(uploaded.status(), await uploaded.text()).toBe(201);
  const { path, token } = await uploaded.json() as { path: string; token: string };
  expect(path).toMatch(/^reviews\/[^/]+\/photos\/[0-9a-f-]+\.png$/);
  const storageClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const directUpload = await storageClient.storage.from('ugc').uploadToSignedUrl(path, token, file.buffer, { contentType: file.mimeType });
  expect(directUpload.error).toBeNull();
  const completed = await request.post('/api/reviews/media', {
    headers: {
      cookie: await sessionCookieHeader(USERS.alice),
      'x-forwarded-for': `review-media-complete-${crypto.randomUUID()}`,
    },
    data: { action: 'complete', kind: 'photo', contentType: file.mimeType, size: file.buffer.length, path },
  });
  expect(completed.status(), await completed.text()).toBe(200);

  const bypassPrepared = await request.post('/api/reviews/media', {
    headers: { cookie: await sessionCookieHeader(USERS.alice), 'x-forwarded-for': `review-media-bypass-${crypto.randomUUID()}` },
    data: metadata,
  });
  const bypassUpload = await bypassPrepared.json() as { path: string; token: string };
  expect((await storageClient.storage.from('ugc').uploadToSignedUrl(bypassUpload.path, bypassUpload.token, file.buffer, { contentType: file.mimeType })).error).toBeNull();

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

    const skippedCompletion = await request.post('/api/reviews', {
      headers: { cookie: await sessionCookieHeader(USERS.alice), 'x-forwarded-for': `review-media-skip-${crypto.randomUUID()}` },
      data: { product_id: 'e2e-review-media', product_handle: 'e2e-review-media', rating: 5, body_text: 'This media skipped server completion validation.', photo_urls: [bypassUpload.path] },
    });
    expect(skippedCompletion.status()).toBe(400);

    const validReview = await request.post('/api/reviews', {
      headers: { cookie: await sessionCookieHeader(USERS.alice), 'x-forwarded-for': `review-media-valid-${crypto.randomUUID()}` },
      data: { product_id: 'e2e-review-media', product_handle: 'e2e-review-media', rating: 5, body_text: 'This media completed server validation successfully.', photo_urls: [path] },
    });
    expect(validReview.status(), await validReview.text()).toBe(200);
    const validReviewId = ((await validReview.json()) as { review: { id: string } }).review.id;
    await admin().from('reviews').delete().eq('id', validReviewId);

    const forgedDelete = await request.delete('/api/reviews/media', {
      headers: { cookie: await sessionCookieHeader(USERS.bob) },
      data: { paths: [path] },
    });
    expect(forgedDelete.status()).toBe(400);
  } finally {
    await admin().storage.from('ugc').remove([path, bypassUpload.path]);
    await admin().from('review_media_validations' as never).delete().in('path', [path, bypassUpload.path]);
  }
});
