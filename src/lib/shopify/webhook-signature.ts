import crypto from 'crypto';

type ShopifyWebhookEnv = {
  [key: string]: string | undefined;
  SHOPIFY_WEBHOOK_SECRET?: string;
  SHOPIFY_API_SECRET?: string;
  SHOPIFY_CLIENT_SECRET?: string;
};

export function shopifyWebhookSecrets(env: ShopifyWebhookEnv = process.env): string[] {
  return [...new Set([
    env.SHOPIFY_WEBHOOK_SECRET,
    env.SHOPIFY_API_SECRET,
    env.SHOPIFY_CLIENT_SECRET,
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

export function verifyShopifyWebhook(
  body: Buffer,
  signature: string,
  env: ShopifyWebhookEnv = process.env,
): boolean {
  if (!signature) return false;

  let received: Buffer;
  try {
    received = Buffer.from(signature, 'base64');
  } catch {
    return false;
  }

  return shopifyWebhookSecrets(env).some((secret) => {
    const expected = crypto.createHmac('sha256', secret).update(body).digest();
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  });
}
