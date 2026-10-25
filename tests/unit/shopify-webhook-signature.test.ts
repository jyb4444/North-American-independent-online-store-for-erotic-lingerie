import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { shopifyWebhookSecrets, verifyShopifyWebhook } from '../../src/lib/shopify/webhook-signature';

const body = Buffer.from('{"id":1010}');
const sign = (secret: string) => crypto.createHmac('sha256', secret).update(body).digest('base64');

test('app-managed Shopify webhooks accept the app client secret', () => {
  const env = { SHOPIFY_CLIENT_SECRET: 'current-app-secret' };
  assert.equal(verifyShopifyWebhook(body, sign(env.SHOPIFY_CLIENT_SECRET), env), true);
});

test('legacy manually configured webhook secrets remain supported', () => {
  const env = {
    SHOPIFY_CLIENT_SECRET: 'current-app-secret',
    SHOPIFY_WEBHOOK_SECRET: 'legacy-webhook-secret',
  };
  assert.equal(verifyShopifyWebhook(body, sign(env.SHOPIFY_WEBHOOK_SECRET), env), true);
});

test('invalid signatures and missing secrets fail closed', () => {
  assert.equal(verifyShopifyWebhook(body, sign('wrong-secret'), { SHOPIFY_CLIENT_SECRET: 'current-app-secret' }), false);
  assert.equal(verifyShopifyWebhook(body, '', { SHOPIFY_CLIENT_SECRET: 'current-app-secret' }), false);
  assert.equal(verifyShopifyWebhook(body, sign('secret'), {}), false);
});

test('duplicate configured secrets are checked once', () => {
  assert.deepEqual(shopifyWebhookSecrets({
    SHOPIFY_WEBHOOK_SECRET: 'same-secret',
    SHOPIFY_API_SECRET: ' same-secret ',
    SHOPIFY_CLIENT_SECRET: 'same-secret',
  }), ['same-secret']);
});
