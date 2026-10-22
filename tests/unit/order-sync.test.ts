import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalShopifyId, normalizeShipmentStatus, shopifyOrderEmailQuery } from '../../src/lib/logistics';

test('order repair uses an exact normalized Shopify email search', () => {
  assert.equal(shopifyOrderEmailQuery('  Customer+Tag@Example.COM  '), 'email:"customer+tag@example.com"');
  assert.equal(shopifyOrderEmailQuery('a"b@example.com'), 'email:"a\\"b@example.com"');
});

test('REST and GraphQL Shopify resource IDs use one canonical identity', () => {
  assert.equal(canonicalShopifyId(123, 'LineItem'), '123');
  assert.equal(canonicalShopifyId('gid://shopify/LineItem/123', 'LineItem'), '123');
});

test('delivery states are mapped exactly', () => {
  assert.equal(normalizeShipmentStatus({ shipment_status: 'delivered' }), 'delivered');
  assert.equal(normalizeShipmentStatus({ shipment_status: 'out_for_delivery' }), 'in_transit');
  assert.equal(normalizeShipmentStatus({ shipment_status: 'attempted_delivery' }), 'exception');
  assert.equal(normalizeShipmentStatus({ status: 'cancelled', tracking_number: 'TRACK' }), 'cancelled');
});
