// Runs as a separate process (like a separate server instance): calls rateLimit() N times
// for one key and prints the results as JSON. Used by tests/api/rate-limit.spec.ts.
import { rateLimit } from '@/lib/rate-limit';

// The local Upstash stand-in (serverless-redis-http + open-source Redis) does not support the
// Upstash-only `#!lua flags=allow-key-locking` script header that @upstash/ratelimit sends.
// For local tests only, strip that header line; the Lua algorithm itself is unchanged.
if (process.env.E2E_STRIP_UPSTASH_SCRIPT_FLAGS === '1') {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    if (typeof init?.body === 'string' && init.body.includes('#!lua flags=allow-key-locking')) {
      init = { ...init, body: init.body.replaceAll('#!lua flags=allow-key-locking\\n', '') };
    }
    return originalFetch(input, init);
  };
}

async function main() {
  const [key, calls, limit] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4])];
  const results: boolean[] = [];
  for (let i = 0; i < calls; i++) {
    results.push((await rateLimit(key, { limit, windowMs: 60_000 })).allowed);
  }
  console.log(JSON.stringify(results));
  process.exit(0);
}

void main();
