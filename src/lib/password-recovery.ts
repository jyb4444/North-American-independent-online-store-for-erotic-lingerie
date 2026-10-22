import crypto from 'node:crypto';

const MAX_AGE_SECONDS = 10 * 60;

function secret() {
  const value = process.env.PASSWORD_RECOVERY_SECRET;
  if (!value || value.length < 32) throw new Error('PASSWORD_RECOVERY_SECRET is not configured');
  return value;
}

export function createRecoveryProof(userId: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt: now + MAX_AGE_SECONDS * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyRecoveryProof(value: string | undefined, userId: string, now = Date.now()) {
  if (!value) return false;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return false;
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return false;
  try {
    const proof = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { userId?: unknown; expiresAt?: unknown };
    return proof.userId === userId && typeof proof.expiresAt === 'number' && proof.expiresAt >= now && proof.expiresAt <= now + MAX_AGE_SECONDS * 1000;
  } catch { return false; }
}

export const recoveryProofMaxAge = MAX_AGE_SECONDS;
