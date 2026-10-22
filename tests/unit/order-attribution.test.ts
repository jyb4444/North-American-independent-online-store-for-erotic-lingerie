import assert from 'node:assert/strict';
import test from 'node:test';
import { createOrderAttribution, readOrderAttribution } from '../../src/lib/shopify/order-attribution';

const USER = 'f52bf724-78e6-4b15-8a19-a49b73a8fd19';

test('signed Shopify cart attribution survives a checkout email change', () => {
  process.env.SHOPIFY_WEBHOOK_SECRET = 'unit-test-secret';
  const attribute = createOrderAttribution(USER);
  assert.ok(attribute);
  assert.equal(readOrderAttribution([attribute]), USER);
});

test('tampered attribution cannot claim another account', () => {
  process.env.SHOPIFY_WEBHOOK_SECRET = 'unit-test-secret';
  const attribute = createOrderAttribution(USER)!;
  assert.equal(readOrderAttribution([{ ...attribute, value: attribute.value.replace(USER, '00000000-0000-4000-8000-000000000000') }]), null);
  assert.equal(readOrderAttribution([{ ...attribute, value: `${attribute.value}x` }]), null);
});
