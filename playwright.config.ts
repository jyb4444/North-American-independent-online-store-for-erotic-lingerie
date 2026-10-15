import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { defineConfig, devices } from '@playwright/test';

const legacy = process.env.E2E_SCHEMA_MODE === 'legacy';
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

// Load the test environment into this process (and therefore every worker).
const testEnv = parseEnv(fs.readFileSync(path.join(__dirname, 'tests/e2e.env'), 'utf8')) as Record<string, string>;

// Any key that exists in .env.local but not in tests/e2e.env is blanked out, so the
// test server can never silently fall back to a real credential from .env.local.
const localEnvPath = path.join(__dirname, '.env.local');
if (fs.existsSync(localEnvPath)) {
  for (const key of Object.keys(parseEnv(fs.readFileSync(localEnvPath, 'utf8')))) {
    if (!(key in testEnv)) testEnv[key] = '';
  }
}

if (legacy) testEnv.REFERRAL_REWARDS_ENABLED = 'false';
Object.assign(process.env, testEnv);

if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(testEnv.NEXT_PUBLIC_SUPABASE_URL ?? '')) {
  throw new Error('Refusing to run: NEXT_PUBLIC_SUPABASE_URL in tests/e2e.env must point at the local Supabase stack.');
}

export default defineConfig({
  testDir: 'tests',
  testMatch: legacy ? ['api/compatibility.spec.ts'] : ['api/**/*.spec.ts', 'e2e/**/*.spec.ts'],
  globalSetup: './tests/global-setup.ts',
  // All specs share one local database; run serially until specs get their own data sets.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: legacy ? [{ name: 'legacy', testMatch: 'api/compatibility.spec.ts' }] : [
    { name: 'api', testMatch: 'api/**/*.spec.ts' },
    { name: 'e2e-chrome', testMatch: 'e2e/**/*.spec.ts', testIgnore: 'e2e/mobile.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'e2e-mobile', testMatch: 'e2e/mobile.spec.ts', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      // Local stand-in for the Shopify Storefront API (see tests/mocks/shopify-storefront.ts).
      command: 'npx tsx tests/mocks/shopify-storefront.ts',
      url: 'http://127.0.0.1:3199/__health',
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `npx next build && npx next start -p ${PORT}`,
      url: BASE_URL,
      env: { ...testEnv, NEXT_DIST_DIR: legacy ? '.next-e2e-legacy' : '.next-e2e', NEXT_TELEMETRY_DISABLED: '1' },
      timeout: 300_000,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
