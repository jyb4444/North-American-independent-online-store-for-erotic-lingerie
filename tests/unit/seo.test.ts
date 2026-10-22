import assert from 'node:assert/strict';
import test from 'node:test';
import { hasPublicCatalogTags, isPublicCollectionHandle, isPublicProductHandle } from '../../src/lib/catalog-visibility';
import { conciseDescription, safeJsonLd } from '../../src/lib/seo';

test('catalog visibility keeps products awaiting manual review out of public routes', () => {
  assert.equal(isPublicProductHandle('fishnet-halter-bodystocking'), false);
  assert.equal(isPublicProductHandle('half-cup-underwire-lace-bodysuit-waist-cinching-lingerie'), false);
  assert.equal(isPublicProductHandle('leopard-jacquard-pearl-bodysuit-mesh-lingerie-set'), false);
  assert.equal(isPublicProductHandle('bow-corset-garter-set'), true);
  assert.equal(isPublicCollectionHandle('frontpage'), false);
  assert.equal(isPublicCollectionHandle('all'), true);
});

test('Shopify moderation tags hide products without a code change', () => {
  assert.equal(hasPublicCatalogTags(['Bodysuit', 'manual-review']), false);
  assert.equal(hasPublicCatalogTags(['hide-from-storefront']), false);
  assert.equal(hasPublicCatalogTags(['Bodysuit', 'active']), true);
});

test('SEO text is plain, bounded and safe inside JSON-LD script tags', () => {
  const description = conciseDescription('<p>A carefully selected <strong>style</strong>.</p>');
  assert.equal(description, 'A carefully selected style.');
  assert.ok(description.length <= 160);
  assert.equal(safeJsonLd({ value: '</script><script>alert(1)</script>' }).includes('<'), false);
});
