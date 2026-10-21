function getShopifyConfig() {
  const domain = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN;
  const token = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;

  if (!domain || domain === 'your-store.myshopify.com' || !token || token === 'your-storefront-access-token') {
    return null;
  }

  return {
    // E2E_SHOPIFY_STOREFRONT_URL is only set by the test environment (local mock Storefront API).
    endpoint: process.env.E2E_SHOPIFY_STOREFRONT_URL || `https://${domain}/api/2026-01/graphql.json`,
    token,
  };
}

export function hasShopifyConfig() {
  return getShopifyConfig() !== null;
}

export async function shopifyFetch<T>({
  query,
  variables,
  cache = 'force-cache',
  revalidate,
  buyerIp,
}: {
  query: string;
  variables?: Record<string, unknown>;
  cache?: RequestCache;
  /** Seconds to reuse the response across requests; takes precedence over `cache`. */
  revalidate?: number;
  /** Original buyer IP for server-side cart requests and authenticated checkout continuity. */
  buyerIp?: string;
}): Promise<T> {
  const config = getShopifyConfig();
  if (!config) {
    throw new Error('Shopify Storefront API is not configured');
  }

  const res = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': config.token,
      ...(buyerIp ? { 'Shopify-Storefront-Buyer-IP': buyerIp } : {}),
    },
    body: JSON.stringify({ query, variables }),
    ...(revalidate !== undefined ? { next: { revalidate } } : { cache }),
  });

  if (!res.ok) {
    throw new Error(`Shopify API error: ${res.status}`);
  }

  const json = await res.json();

  if (json.errors) {
    throw new Error(json.errors[0].message);
  }

  return json.data as T;
}
