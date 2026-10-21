/**
 * D21 — rate limits are shared across server instances via Upstash Redis.
 * Runs against serverless-redis-http (an open-source, Upstash-compatible REST server):
 *   docker run -p 55479:80 -e SRH_MODE=env -e SRH_TOKEN=e2e-upstash-token \
 *     -e SRH_CONNECTION_STRING=redis://<redis 7.4+>:6379 hiett/serverless-redis-http
 * Each "instance" is a separate Node process, so they can only share counts through Redis.
 * Open-source Redis lacks one Upstash-only script flag; the probe strips it (see the probe).
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const SRH_URL = 'http://127.0.0.1:55479';
const SRH_TOKEN = 'e2e-upstash-token';
const ROOT = path.resolve(__dirname, '../..');

function instance(env: Record<string, string>, key: string, calls: number, limit: number): boolean[] {
  const output = execFileSync('npx', ['tsx', 'tests/helpers/rate-limit-probe.ts', key, String(calls), String(limit)], {
    cwd: ROOT,
    env: { ...process.env, UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '', KV_REST_API_URL: '', KV_REST_API_TOKEN: '', ...env },
    encoding: 'utf8',
  });
  return JSON.parse(output.trim().split('\n').at(-1)!);
}

test.beforeAll(async () => {
  const ok = await fetch(`${SRH_URL}/`, {
    method: 'POST',
    headers: { authorization: `Bearer ${SRH_TOKEN}`, 'content-type': 'application/json' },
    body: '["PING"]',
  }).then((res) => res.ok).catch(() => false);
  test.skip(!ok, 'Upstash-compatible server (serverless-redis-http) is not running on :55479');
});

test('two server instances share one limit through Upstash', () => {
  const env = { UPSTASH_REDIS_REST_URL: SRH_URL, UPSTASH_REDIS_REST_TOKEN: SRH_TOKEN, E2E_STRIP_UPSTASH_SCRIPT_FLAGS: '1' };
  const key = `e2e-shared-${Date.now()}`;
  expect(instance(env, key, 2, 3)).toEqual([true, true]);
  // A different process: with per-instance memory this would start again at 0.
  expect(instance(env, key, 2, 3)).toEqual([true, false]);
});

test('the Vercel Marketplace variable names (KV_REST_API_*) work too', () => {
  const env = { KV_REST_API_URL: SRH_URL, KV_REST_API_TOKEN: SRH_TOKEN, E2E_STRIP_UPSTASH_SCRIPT_FLAGS: '1' };
  const key = `e2e-kv-${Date.now()}`;
  expect(instance(env, key, 1, 1)).toEqual([true]);
  expect(instance(env, key, 1, 1)).toEqual([false]);
});

test('if Upstash is unreachable, requests are still served (per-instance fallback)', () => {
  const env = { UPSTASH_REDIS_REST_URL: 'http://127.0.0.1:9', UPSTASH_REDIS_REST_TOKEN: 'x' };
  expect(instance(env, `e2e-down-${Date.now()}`, 3, 2)).toEqual([true, true, false]);
});

test('without Upstash configured, the in-memory limiter is used', () => {
  expect(instance({}, `e2e-memory-${Date.now()}`, 3, 2)).toEqual([true, true, false]);
});
