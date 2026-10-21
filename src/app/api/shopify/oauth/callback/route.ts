import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { escapeHtml } from '@/lib/email';

function verifyHmac(searchParams: URLSearchParams, secret: string) {
  const hmac = searchParams.get('hmac');
  if (!hmac) return false;

  const params = new URLSearchParams(searchParams);
  params.delete('hmac');
  params.delete('signature');

  const message = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const digest = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  const expected = Buffer.from(digest);
  const received = Buffer.from(hmac);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function tokenPage(token: string, scope: string, shop: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Shopify Admin Token</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #12070b; color: #f8efe7; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(760px, calc(100vw - 32px)); border: 1px solid rgba(214, 175, 97, .35); background: #1d0b12; padding: 28px; }
      h1 { margin: 0 0 12px; font-size: 24px; font-weight: 400; }
      p { color: #c9b8b0; line-height: 1.6; }
      code, textarea { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      textarea { width: 100%; min-height: 120px; box-sizing: border-box; margin-top: 12px; padding: 14px; border: 1px solid rgba(214, 175, 97, .35); background: #100609; color: #f8efe7; }
      .meta { margin-top: 16px; font-size: 13px; color: #a89088; }
    </style>
  </head>
  <body>
    <main>
      <h1>Shopify Admin token created</h1>
      <p>Copy this value into <code>SHOPIFY_ADMIN_TOKEN</code> in <code>.env.local</code>. Treat it like a password and do not share it.</p>
      <textarea readonly>${escapeHtml(token)}</textarea>
      <p class="meta">Shop: ${escapeHtml(shop)} · Scope: ${escapeHtml(scope)}</p>
    </main>
  </body>
</html>`;
}

export async function GET(request: NextRequest) {
  // One-off setup tool that prints an Admin API token; off unless explicitly enabled.
  if (process.env.SHOPIFY_OAUTH_SETUP_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const clientId = process.env.SHOPIFY_API_KEY ?? process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_API_SECRET ?? process.env.SHOPIFY_CLIENT_SECRET;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const shop = searchParams.get('shop');
  const state = searchParams.get('state');
  const cookieStore = await cookies();
  const expectedState = cookieStore.get('shopify_oauth_state')?.value;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Missing SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET' }, { status: 500 });
  }

  if (!code || !shop || !state || state !== expectedState || !/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) {
    return NextResponse.json({ error: 'Invalid Shopify OAuth callback state' }, { status: 400 });
  }

  if (!verifyHmac(searchParams, clientSecret)) {
    return NextResponse.json({ error: 'Invalid Shopify OAuth callback signature' }, { status: 401 });
  }

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    return NextResponse.json({ error: data.error_description ?? data.error ?? 'Could not exchange Shopify token' }, { status: 400 });
  }

  cookieStore.delete('shopify_oauth_state');

  return new NextResponse(tokenPage(data.access_token, data.scope ?? '', shop), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
