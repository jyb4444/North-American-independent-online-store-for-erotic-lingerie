import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

// write_discounts: referral reward codes (discountCodeBasicCreate).
const SCOPES = 'read_orders,write_orders,read_products,write_products,read_discounts,write_discounts,read_fulfillments';

function getShopDomain(value: string | null) {
  const fallback = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN;
  const shop = (value || fallback || '').trim().replace(/^https?:\/\//, '');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)) return null;
  return shop;
}

export async function GET(request: NextRequest) {
  // One-off setup tool (see oauth/callback); off unless explicitly enabled.
  if (process.env.SHOPIFY_OAUTH_SETUP_ENABLED !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const clientId = process.env.SHOPIFY_API_KEY ?? process.env.SHOPIFY_CLIENT_ID;
  const { searchParams, origin } = new URL(request.url);
  const shop = getShopDomain(searchParams.get('shop'));

  if (!shop || !clientId) {
    return NextResponse.json({ error: 'Missing Shopify shop or client ID' }, { status: 400 });
  }

  const state = crypto.randomBytes(24).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set('shopify_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: origin.startsWith('https://'),
    maxAge: 60 * 10,
    path: '/',
  });

  const redirectUri = `${origin}/api/shopify/oauth/callback`;
  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl);
}
