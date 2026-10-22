import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSize } from '../../src/lib/products';

test('known one-size aliases normalize to Free Size', () => {
  for (const value of ['One Size','onesize','ONE-SIZE','Free','Free Size']) assert.equal(normalizeSize(value), 'Free Size');
});

test('unknown Shopify size labels are preserved instead of misrepresented', () => {
  assert.equal(normalizeSize('34C'), '34C');
  assert.equal(normalizeSize('Queen 1X-3X'), 'Queen 1X-3X');
  assert.equal(normalizeSize('2XL'), 'XXL');
});
