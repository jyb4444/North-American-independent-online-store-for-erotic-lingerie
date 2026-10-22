const domain = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_TOKEN;
const site = process.env.NEXT_PUBLIC_SITE_URL;
if (!domain || !token || !site) {
  console.error('Missing NEXT_PUBLIC_SHOPIFY_DOMAIN, SHOPIFY_ADMIN_TOKEN, or NEXT_PUBLIC_SITE_URL.');
  process.exit(2);
}
const expectedUri = new URL('/api/shopify/webhook', site).toString();
const expectedTopics = new Set([
  'ORDERS_CREATE','ORDERS_PAID','ORDERS_UPDATED','ORDERS_FULFILLED',
  'FULFILLMENTS_CREATE','FULFILLMENTS_UPDATE',
]);
const response = await fetch(`https://${domain}/admin/api/2026-01/graphql.json`, {
  method: 'POST', headers: {'Content-Type':'application/json','X-Shopify-Access-Token':token},
  body: JSON.stringify({query:`query WebhookReadiness { webhookSubscriptions(first: 100) { nodes { topic endpoint { __typename ... on WebhookHttpEndpoint { callbackUrl } } } } }`}),
});
const body = await response.json();
if (!response.ok || body.errors) { console.error('Unable to read Shopify webhook subscriptions.'); process.exit(2); }
const nodes = body.data?.webhookSubscriptions?.nodes ?? [];
const configured = new Set(nodes.filter((node) => node.endpoint?.callbackUrl === expectedUri).map((node) => node.topic));
const missing = [...expectedTopics].filter((topic) => !configured.has(topic));
console.log(JSON.stringify({ expectedCallback: expectedUri, configuredTopics: [...configured].sort(), missingTopics: missing.sort() }, null, 2));
if (missing.length) process.exit(1);
