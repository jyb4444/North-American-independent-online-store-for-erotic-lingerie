import assert from 'node:assert/strict';
import test from 'node:test';
import { shopifyOrderEmailQuery } from '../../src/lib/logistics';

test('order repair uses an exact normalized Shopify email search', () => {
  assert.equal(shopifyOrderEmailQuery('  Customer+Tag@Example.COM  '), 'email:"customer+tag@example.com"');
  assert.equal(shopifyOrderEmailQuery('a"b@example.com'), 'email:"a\\"b@example.com"');
});
