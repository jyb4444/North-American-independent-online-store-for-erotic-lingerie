import crypto from 'crypto';

const KEY = 'self_love_account';

function secret() {
  return process.env.SHOPIFY_WEBHOOK_SECRET?.trim() || null;
}

export function createOrderAttribution(userId: string): { key: string; value: string } | null {
  const key = secret();
  if (!key || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const signature = crypto.createHmac('sha256', key).update(userId).digest('base64url');
  return { key: KEY, value: `v1.${userId}.${signature}` };
}

export function readOrderAttribution(attributes: Array<{ key?: string | null; name?: string | null; value?: string | null }> | null | undefined): string | null {
  const key = secret();
  if (!key) return null;
  const token = attributes?.find((item) => (item.key ?? item.name) === KEY)?.value;
  const match = token?.match(/^v1\.([0-9a-f-]{36})\.([A-Za-z0-9_-]+)$/i);
  if (!match) return null;
  const expected = crypto.createHmac('sha256', key).update(match[1]).digest();
  let actual: Buffer;
  try { actual = Buffer.from(match[2], 'base64url'); } catch { return null; }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) ? match[1] : null;
}
