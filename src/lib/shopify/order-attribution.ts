import crypto from 'crypto';

const KEY = 'self_love_account';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  const value = process.env.ORDER_ATTRIBUTION_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

export function createOrderAttribution(userId: string, now = Date.now()): { key: string; value: string } | null {
  const key = secret();
  if (!key || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const issuedAt = Math.floor(now / 1000);
  const payload = `${userId}.${issuedAt}`;
  const signature = crypto.createHmac('sha256', key).update(payload).digest('base64url');
  return { key: KEY, value: `v2.${payload}.${signature}` };
}

export function readOrderAttribution(attributes: Array<{ key?: string | null; name?: string | null; value?: string | null }> | null | undefined, now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const token = attributes?.find((item) => (item.key ?? item.name) === KEY)?.value;
  const match = token?.match(/^v2\.([0-9a-f-]{36})\.(\d{10})\.([A-Za-z0-9_-]+)$/i);
  if (!match) return null;
  const issuedAt = Number(match[2]) * 1000;
  if (!Number.isFinite(issuedAt) || issuedAt > now + 5 * 60 * 1000 || now - issuedAt > MAX_AGE_MS) return null;
  const expected = crypto.createHmac('sha256', key).update(`${match[1]}.${match[2]}`).digest();
  let actual: Buffer;
  try { actual = Buffer.from(match[3], 'base64url'); } catch { return null; }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) ? match[1] : null;
}
