import { test as base, expect, type Page } from '@playwright/test';
import { TEST_PASSWORD } from '../helpers/supabase';

export { expect };

const SITE = 'http://localhost:3100';

/**
 * Product images in the built-in catalogue live on the hosted Supabase storage bucket. When
 * the test machine has no internet access the image optimizer fails for them; that is an
 * environment limitation, not an app defect, so those failures are not counted.
 */
function isExternalImageNoise(text: string) {
  return /\/_next\/image\?url=https?%3A%2F%2F(?!localhost|127\.0\.0\.1)/.test(text);
}

type PageIssues = { consoleErrors: string[]; pageErrors: string[]; serverErrors: string[] };

type Fixtures = {
  /** Skip the age gate and promotional pop-ups (default true). */
  quietPopups: boolean;
  /** Fail the test on console errors, uncaught exceptions or 5xx responses (default true). */
  failOnPageIssues: boolean;
  /** Console errors a test expects (e.g. the 400 from a deliberately wrong password). */
  expectedConsoleErrors: RegExp[];
  issues: PageIssues;
};

export const test = base.extend<Fixtures>({
  quietPopups: [true, { option: true }],
  failOnPageIssues: [true, { option: true }],
  expectedConsoleErrors: [[], { option: true }],

  issues: async ({}, provide) => {
    await provide({ consoleErrors: [], pageErrors: [], serverErrors: [] });
  },

  page: async ({ page, quietPopups, failOnPageIssues, expectedConsoleErrors, issues }, provide, testInfo) => {
    if (quietPopups) {
      await page.context().addCookies([{ name: 'velour_age_verified', value: '1', url: SITE }]);
      await page.addInitScript(() => {
        localStorage.setItem('velour_cookie_consent_v1', 'denied');
        localStorage.setItem('velour_newsletter_dismissed', '1');
        localStorage.setItem('velour_first_free_offer_v1', JSON.stringify({ dismissedAt: new Date().toISOString() }));
      });
    }

    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const location = message.location()?.url ?? '';
      if (isExternalImageNoise(message.text()) || isExternalImageNoise(location)) return;
      if (expectedConsoleErrors.some((pattern) => pattern.test(`${message.text()} ${location}`))) return;
      issues.consoleErrors.push(`${message.text()}${location ? ` (${location})` : ''}`);
    });
    page.on('pageerror', (error) => issues.pageErrors.push(error.stack ?? error.message));
    page.on('response', (response) => {
      const url = response.url();
      if (response.status() >= 500 && url.startsWith(SITE) && !isExternalImageNoise(url)) {
        issues.serverErrors.push(`${response.status()} ${response.request().method()} ${url}`);
      }
    });

    await provide(page);

    const summary = [
      ...issues.pageErrors.map((e) => `[uncaught] ${e}`),
      ...issues.serverErrors.map((e) => `[5xx] ${e}`),
      ...issues.consoleErrors.map((e) => `[console] ${e}`),
    ];
    if (summary.length) await testInfo.attach('page-issues', { body: summary.join('\n'), contentType: 'text/plain' });
    if (failOnPageIssues) {
      expect(summary, 'browser errors / server errors during the test').toEqual([]);
    }
  },
});

/** Signs in through the real login form. */
export async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
  await page.locator('form').getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/account');
}
