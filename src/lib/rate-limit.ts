import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };
type RateLimitOptions = { limit?: number; windowMs?: number };

// ─── Shared store (Upstash Redis) ──────────────────────────────────────────────
// Serverless deployments run many instances, so limits must live in a shared store.
// Configured by the Vercel Marketplace "Upstash for Redis" integration, which sets
// KV_REST_API_URL / KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.

function hasUpstashConfig() {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
  );
}

let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

function upstashLimiter(limit: number, windowMs: number): Ratelimit {
  const id = `${limit}:${windowMs}`;
  let limiter = limiters.get(id);
  if (!limiter) {
    // Fail fast so an unreachable store falls back quickly instead of stalling requests.
    redis ??= Redis.fromEnv({ retry: { retries: 1, backoff: () => 50 } });
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: 'self-love:rl',
      timeout: 1_000, // never hold a request up for long if Redis is slow
    });
    limiters.set(id, limiter);
  }
  return limiter;
}

// ─── In-memory fallback (local development, tests, Redis outage) ───────────────

type RateLimitEntry = { count: number; resetAt: number };

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      if (now > entry.resetAt) store.delete(key);
    });
  }, 5 * 60 * 1000).unref?.();
}

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  entry.count += 1;
  const allowed = entry.count <= limit;
  return { allowed, remaining: Math.max(0, limit - entry.count), resetAt: entry.resetAt };
}

/**
 * Counts one request for `key` and reports whether it is within `limit` per `windowMs`.
 * Uses Upstash Redis when configured; otherwise (or if Redis is unreachable) a per-instance
 * in-memory counter, so a store outage degrades protection instead of taking the site down.
 */
export async function rateLimit(
  key: string,
  { limit = 20, windowMs = 60_000 }: RateLimitOptions = {},
): Promise<RateLimitResult> {
  if (hasUpstashConfig()) {
    try {
      const { success, remaining, reset, reason } = await upstashLimiter(limit, windowMs).limit(key);
      // On timeout the SDK lets the request through without counting it; treat that as the
      // store being unavailable so the per-instance limiter still applies.
      if (reason !== 'timeout') return { allowed: success, remaining, resetAt: reset };
      console.error('Rate limit store timed out, using in-memory fallback');
    } catch (error) {
      console.error('Rate limit store unavailable, using in-memory fallback:', error);
    }
  }
  return memoryRateLimit(key, limit, windowMs);
}

export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}
