import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewMediaBytesMatch, reviewMediaPathForUser, storedReviewMediaPath } from '../../src/lib/review-media';

test('review media paths are scoped to the authenticated user', () => {
  assert.equal(reviewMediaPathForUser('reviews/user-a/photos/file.jpg', 'user-a'), true);
  assert.equal(reviewMediaPathForUser('reviews/user-b/photos/file.jpg', 'user-a'), false);
  assert.equal(reviewMediaPathForUser('reviews/user-a/../user-b/file.jpg', 'user-a'), false);
});

test('review media MIME declarations must match the file signature', () => {
  assert.equal(reviewMediaBytesMatch('image/png', Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])), true);
  assert.equal(reviewMediaBytesMatch('image/png', new TextEncoder().encode('<script>')), false);
  assert.equal(reviewMediaBytesMatch('image/jpeg', Uint8Array.from([0xff,0xd8,0xff,0xe0])), true);
  assert.equal(reviewMediaBytesMatch('video/webm', Uint8Array.from([0x1a,0x45,0xdf,0xa3])), true);
});

test('legacy public review URLs are converted to private storage paths', () => {
  assert.equal(
    storedReviewMediaPath('https://example.supabase.co/storage/v1/object/public/ugc/reviews/photos/old.jpg'),
    'reviews/photos/old.jpg',
  );
  assert.equal(storedReviewMediaPath('https://example.com/unrelated.jpg'), null);
  assert.equal(storedReviewMediaPath('reviews/user-a/videos/file.mp4'), 'reviews/user-a/videos/file.mp4');
});
