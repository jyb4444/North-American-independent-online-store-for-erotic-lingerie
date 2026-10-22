const HIDDEN_PRODUCT_HANDLES = new Set([
  'fishnet-halter-bodystocking',
  'half-cup-underwire-lace-bodysuit-waist-cinching-lingerie',
  'leopard-jacquard-pearl-bodysuit-mesh-lingerie-set',
]);

const HIDDEN_COLLECTION_HANDLES = new Set(['frontpage']);

export function isPublicProductHandle(handle: string) {
  return !HIDDEN_PRODUCT_HANDLES.has(handle);
}

export function hasPublicCatalogTags(tags: string[]) {
  const normalized = new Set(tags.map((tag) => tag.trim().toLowerCase()));
  return !normalized.has('hide-from-storefront') && !normalized.has('manual-review');
}

export function isPublicCollectionHandle(handle: string) {
  return !HIDDEN_COLLECTION_HANDLES.has(handle);
}
