import crypto from 'node:crypto';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const TEST_PASSWORD = 'Test1234!';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}; tests must be run through playwright.config.ts`);
  return value;
}

export const SUPABASE_URL = () => env('NEXT_PUBLIC_SUPABASE_URL');
const ANON_KEY = () => env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const SERVICE_KEY = () => env('SUPABASE_SERVICE_ROLE_KEY');

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Unauthenticated client — exactly what any visitor can do with the public anon key. */
export function anon(): SupabaseClient {
  return createClient(SUPABASE_URL(), ANON_KEY(), noSession);
}

/** Service-role client — bypasses RLS. Only for seeding and for reading back ground truth. */
export function admin(): SupabaseClient {
  return createClient(SUPABASE_URL(), SERVICE_KEY(), noSession);
}

/** A client signed in as the given user, using only the public anon key (like the browser). */
export async function asUser(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL(), ANON_KEY(), noSession);
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}

/** An @supabase/ssr client backed by an in-memory cookie jar, mirroring the app's cookie format. */
function cookieJarClient() {
  const jar = new Map<string, string>();
  const client = createServerClient(SUPABASE_URL(), ANON_KEY(), {
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: (cookies) => {
        for (const { name, value } of cookies) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  const cookieHeader = () => Array.from(jar, ([name, value]) => `${name}=${value}`).join('; ');
  return { client, cookieHeader };
}

/** `Cookie` header for a signed-in session, as the Next.js server expects it. */
export async function sessionCookieHeader(email: string): Promise<string> {
  const { client, cookieHeader } = cookieJarClient();
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return cookieHeader();
}

type MailpitSearch = { messages: Array<{ ID: string }> };
type MailpitMessage = { Text: string };

async function clearMailbox() {
  await fetch(`${env('MAILPIT_URL')}/api/v1/messages`, { method: 'DELETE' });
}

async function waitForMagicLink(email: string): Promise<string> {
  const base = env('MAILPIT_URL');
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}&limit=1`);
    const { messages } = (await search.json()) as MailpitSearch;
    if (messages?.length) {
      const message = (await (await fetch(`${base}/api/v1/message/${messages[0].ID}`)).json()) as MailpitMessage;
      const link = message.Text.match(/https?:\/\/\S+\/auth\/v1\/verify\?\S+/)?.[0];
      if (link) return link.replace(/[)\]>]+$/, '');
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No magic-link email arrived for ${email}`);
}

/**
 * Runs a real PKCE magic-link sign-in up to the point where Supabase redirects back to the
 * app, and returns the one-time `code` plus the cookies (code verifier) the browser would hold.
 * The caller then hits /auth/callback itself, with whatever extra query params it wants to test.
 */
export async function pkceCallbackCode(email: string, appBaseUrl: string): Promise<{ code: string; cookieHeader: string }> {
  await clearMailbox();
  const { client, cookieHeader } = cookieJarClient();
  // GoTrue allows one OTP email per user per `max_frequency` (1s locally); retry past it.
  for (let attempt = 0; ; attempt++) {
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${appBaseUrl}/auth/callback` },
    });
    if (!error) break;
    if (attempt >= 5 || !/only request this after/i.test(error.message)) {
      throw new Error(`signInWithOtp failed: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  const verifyUrl = await waitForMagicLink(email);
  const res = await fetch(verifyUrl, { redirect: 'manual' });
  const location = res.headers.get('location') ?? '';
  const code = new URL(location, appBaseUrl).searchParams.get('code');
  if (!code) throw new Error(`Supabase verify did not redirect with a code (status ${res.status}, location "${location}")`);
  return { code, cookieHeader: cookieHeader() };
}

/** Shopify-style webhook signature (base64 HMAC-SHA256 of the raw body). */
export function signShopifyWebhook(body: string): string {
  return crypto.createHmac('sha256', env('SHOPIFY_WEBHOOK_SECRET')).update(body, 'utf8').digest('base64');
}
