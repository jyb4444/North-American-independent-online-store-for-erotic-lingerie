import assert from 'node:assert/strict';
import test from 'node:test';
import { createOrderAttribution, readOrderAttribution } from '../../src/lib/shopify/order-attribution';

const USER = 'f52bf724-78e6-4b15-8a19-a49b73a8fd19';
process.env.ORDER_ATTRIBUTION_SECRET = 'unit-test-order-attribution-secret-at-least-32-characters';

test('signed Shopify cart attribution survives a checkout email change', () => {
  const attribute = createOrderAttribution(USER);
  assert.ok(attribute);
  assert.equal(readOrderAttribution([attribute]), USER);
});

test('tampered attribution cannot claim another account', () => {
  const attribute = createOrderAttribution(USER)!;
  assert.equal(readOrderAttribution([{ ...attribute, value: attribute.value.replace(USER, '00000000-0000-4000-8000-000000000000') }]), null);
  assert.equal(readOrderAttribution([{ ...attribute, value: `${attribute.value}x` }]), null);
});

test('expired attribution cannot claim an account', () => {
  const issuedAt = Date.UTC(2026, 9, 1);
  const attribute = createOrderAttribution(USER, issuedAt)!;
  assert.equal(readOrderAttribution([attribute], issuedAt + 8 * 24 * 60 * 60 * 1000), null);
});
