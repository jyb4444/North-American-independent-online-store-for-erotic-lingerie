function getShopifyConfig() {
  const domain = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN;
  const token = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN;

  if (!domain || domain === 'your-store.myshopify.com' || !token || token === 'your-storefront-access-token') {
    return null;
  }

  return {
    endpoint: `https://${domain}/api/2026-01/graphql.json`,
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
}: {
  query: string;
  variables?: Record<string, unknown>;
  cache?: RequestCache;
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
    },
    body: JSON.stringify({ query, variables }),
    cache,
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
