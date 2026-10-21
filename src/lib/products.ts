/**
 * Product data service.
 * Shopify is the primary source once Storefront API env vars are configured;
 * mock data remains a local fallback so development builds do not break.
 */
import {
  MOCK_PRODUCTS,
  getProductByHandle as mockGetByHandle,
  getBestsellers as mockBestsellers,
  getNewArrivals as mockNewArrivals,
} from '@/mock/products';
import { MOCK_COLLECTIONS, getCollectionByHandle as mockGetCollection } from '@/mock/collections';
import type { Collection, Product, ProductVariant } from '@/types';
import { hasShopifyConfig, shopifyFetch } from '@/lib/shopify/client';
import { GET_COLLECTIONS, GET_COLLECTION_PRODUCTS, GET_PRODUCT_BY_HANDLE, GET_PRODUCTS } from '@/lib/shopify/queries';
import { isPublicCollectionHandle, isPublicProductHandle } from '@/lib/catalog-visibility';

type ShopifyMoney = { amount: string; currencyCode: string };
type ShopifyImage = { url: string; altText: string | null };
type ShopifySelectedOption = { name: string; value: string };
type ShopifyVariant = {
  id: string;
  title: string;
  sku: string | null;
  quantityAvailable?: number | null;
  availableForSale?: boolean;
  selectedOptions: ShopifySelectedOption[];
  price: ShopifyMoney;
  image: ShopifyImage | null;
};
type ShopifyProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  productType: string;
  vendor: string;
  createdAt: string;
  updatedAt: string;
  seo?: { title?: string | null; description?: string | null } | null;
  priceRange: { minVariantPrice: ShopifyMoney };
  compareAtPriceRange: { minVariantPrice: ShopifyMoney };
  images: { edges: { node: ShopifyImage }[] };
  tags: string[];
  variants: { edges: { node: ShopifyVariant }[] };
};
type ProductsResponse = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: ShopifyProduct }[];
  };
};
type ProductResponse = {
  product: ShopifyProduct | null;
};
type CollectionsResponse = {
  collections: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: {
      node: {
        id: string;
        handle: string;
        title: string;
        description?: string;
        image?: ShopifyImage | null;
      };
    }[];
  };
};
type CollectionProductsResponse = {
  collection: {
    id: string;
    title: string;
    description?: string;
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: { node: ShopifyProduct }[];
    };
  } | null;
};

function allowMockFallback() {
  // A production build may run outside Vercel, where VERCEL_ENV is absent. Only
  // development and the explicitly isolated E2E Shopify server may use fixtures.
  return process.env.NODE_ENV !== 'production' || Boolean(process.env.E2E_SHOPIFY_STOREFRONT_URL);
}

function publicProducts(products: Product[]) {
  return products.filter((product) => isPublicProductHandle(product.handle));
}

function publicCollections(collections: Collection[]) {
  return collections.filter((collection) => isPublicCollectionHandle(collection.handle));
}

const SIZE_VALUES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Free Size'] as const;

// In stock but the exact quantity is unknown (the Storefront token may not have inventory
// access). Large enough that no "only N left" scarcity message is shown.
const IN_STOCK_QUANTITY_UNKNOWN = 999;
const COLOR_HEX: Record<string, string> = {
  black: '#0a0a0a',
  white: '#f5ede0',
  ivory: '#f8f1e7',
  red: '#b91c1c',
  pink: '#f4a7b5',
  blue: '#2563eb',
  navy: '#1b2a6b',
  purple: '#7c3aed',
  green: '#2d6a4f',
  grey: '#9ca3af',
  gray: '#9ca3af',
  brown: '#7c4a2d',
  leopard: '#a0785a',
  nude: '#d6a77a',
  beige: '#d8c3a5',
};

function moneyToNumber(money?: ShopifyMoney) {
  const value = Number(money?.amount);
  return Number.isFinite(value) ? value : 0;
}

function normalizeSize(value?: string): ProductVariant['size'] {
  if (!value || value === 'Default Title') return 'Free Size';
  const normalized = value.trim().toUpperCase();
  if (normalized === 'ONE SIZE' || normalized === 'ONESIZE' || normalized === 'FREE') return 'Free Size';
  return SIZE_VALUES.includes(normalized as ProductVariant['size'])
    ? normalized as ProductVariant['size']
    : 'Free Size';
}

function colorHex(color: string) {
  const lower = color.toLowerCase();
  const match = Object.entries(COLOR_HEX).find(([name]) => lower.includes(name));
  return match?.[1] ?? '#8a5a5a';
}

function optionValue(variant: ShopifyVariant, names: string[]) {
  const option = variant.selectedOptions.find((item) =>
    names.some((name) => item.name.toLowerCase().includes(name))
  );
  return option?.value;
}

function categoryFor(product: ShopifyProduct) {
  const type = product.productType?.trim().toLowerCase();
  if (type) return type;

  const tags = product.tags.map((tag) => tag.toLowerCase());
  if (tags.includes('babydoll')) return 'babydoll';
  if (tags.includes('bodysuit')) return 'bodysuit';
  if (tags.includes('bodystocking')) return 'bodystocking';
  if (tags.includes('bra-set')) return 'bra-set';
  if (tags.includes('teddy')) return 'teddy';
  if (tags.includes('hosiery')) return 'hosiery';
  if (tags.includes('corset')) return 'corset';
  if (tags.includes('chemise')) return 'chemise';
  return 'lingerie';
}

function mapShopifyProduct(product: ShopifyProduct): Product {
  const price = moneyToNumber(product.priceRange.minVariantPrice);
  const compareAt = moneyToNumber(product.compareAtPriceRange.minVariantPrice);
  const tags = product.tags.map((tag) => tag.toLowerCase());
  const images = product.images.edges.map(({ node }) => node.url);
  const imageAltTexts = product.images.edges.map(({ node }) => node.altText);
  const category = categoryFor(product);
  const createdAt = Date.parse(product.createdAt);
  const isRecent = Number.isFinite(createdAt) && Date.now() - createdAt < 45 * 24 * 60 * 60 * 1000;

  const variants = product.variants.edges.map(({ node }, index): ProductVariant => {
    const color = optionValue(node, ['color', 'colour']) ?? 'Default';
    const size = normalizeSize(optionValue(node, ['size']) ?? node.title);

    return {
      id: node.id,
      size,
      color,
      colorHex: colorHex(color),
      stock: node.availableForSale === false ? 0 : node.quantityAvailable ?? IN_STOCK_QUANTITY_UNKNOWN,
      sku: node.sku || `${product.handle}-${index + 1}`,
      sourceSku: node.sku || undefined,
      price: moneyToNumber(node.price),
      currency: node.price.currencyCode,
      shopifyVariantId: node.id,
    };
  });

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    description: product.description || 'A carefully selected style from the private edit.',
    price,
    compareAtPrice: compareAt > price ? compareAt : undefined,
    images,
    category,
    tags,
    variants,
    // Real values come from approved reviews (getReviewStats); never invent a rating.
    rating: 0,
    reviewCount: 0,
    isNew: tags.includes('new-arrival') || tags.includes('new') || isRecent,
    isBestseller: tags.includes('bestseller') || tags.includes('best-seller'),
    material: 'See product details for material information.',
    careInstructions: 'Hand wash cold, lay flat to dry.',
    vendor: product.vendor || 'Self Love',
    currency: product.priceRange.minVariantPrice.currencyCode || 'USD',
    updatedAt: product.updatedAt,
    seoTitle: product.seo?.title || undefined,
    seoDescription: product.seo?.description || undefined,
    imageAltTexts,
  };
}

// The full product list backs listings, related products, search and the catalog API. It
// changes rarely, so it is reused for a few minutes instead of being refetched per request.
// Single product pages still fetch their product live (getProductByHandle).
const PRODUCT_LIST_REVALIDATE_SECONDS = 300;

async function getShopifyProducts(): Promise<Product[]> {
  const products: Product[] = [];
  let after: string | undefined;
  do {
    const data = await shopifyFetch<ProductsResponse>({
      query: GET_PRODUCTS,
      variables: { first: 250, after },
      revalidate: PRODUCT_LIST_REVALIDATE_SECONDS,
    });
    products.push(...data.products.edges.map(({ node }) => mapShopifyProduct(node)));
    after = data.products.pageInfo.hasNextPage
      ? data.products.pageInfo.endCursor || undefined
      : undefined;
  } while (after);

  return publicProducts(products);
}

function collectionFilter(handle: string, products: Product[]) {
  switch (handle) {
    case 'all': return products;
    case 'new-arrivals': return products.filter((p) => p.isNew);
    case 'discount': return products.filter((p) => !!p.compareAtPrice);
    case 'first-free': return products.slice(0, 4);
    case 'bestsellers': return products.filter((p) => p.isBestseller);
    case 'plus-size': return products.filter((p) => p.tags.includes('plus-size') || p.variants.some((v) => ['XL', 'XXL'].includes(v.size)));
    case 'babydoll': return products.filter((p) => p.category === 'babydoll');
    case 'bodysuits': return products.filter((p) => ['bodysuit', 'bodystocking'].includes(p.category));
    case 'sets': return products.filter((p) => ['corset', 'bra-set', 'panty', 'babydoll', 'teddy'].includes(p.category));
    case 'robes': return products.filter((p) => ['robe', 'chemise', 'babydoll'].includes(p.category));
    case 'hosiery': return products.filter((p) => p.category === 'hosiery');
    default: return products.filter((p) => p.category === handle || p.tags.includes(handle));
  }
}

export async function getAllProducts(): Promise<Product[]> {
  if (!hasShopifyConfig()) return publicProducts(MOCK_PRODUCTS);

  try {
    return await getShopifyProducts();
  } catch (error) {
    if (!allowMockFallback()) throw error;
    console.error('Shopify products fetch failed, using mock products:', error);
    return publicProducts(MOCK_PRODUCTS);
  }
}

export async function getProductByHandle(handle: string): Promise<Product | undefined> {
  if (!isPublicProductHandle(handle)) return undefined;
  if (!hasShopifyConfig()) return mockGetByHandle(handle);

  try {
    const data = await shopifyFetch<ProductResponse>({
      query: GET_PRODUCT_BY_HANDLE,
      variables: { handle },
      cache: 'no-store',
    });
    return data.product ? mapShopifyProduct(data.product) : undefined;
  } catch (error) {
    if (!allowMockFallback()) throw error;
    console.error('Shopify product fetch failed, using mock product:', error);
    return mockGetByHandle(handle);
  }
}

export async function getProductsByCollection(handle: string): Promise<Product[]> {
  if (!isPublicCollectionHandle(handle)) return [];
  if (!hasShopifyConfig()) return collectionFilter(handle, publicProducts(MOCK_PRODUCTS));

  try {
    // `all` is a storefront utility route. Every other handle should use the
    // Shopify collection membership when that collection actually exists.
    if (handle !== 'all') {
      const products: Product[] = [];
      let foundCollection = false;
      let after: string | undefined;
      do {
        const data = await shopifyFetch<CollectionProductsResponse>({
          query: GET_COLLECTION_PRODUCTS,
          variables: { handle, first: 250, after },
          cache: 'no-store',
        });
        if (!data.collection) break;
        foundCollection = true;
        products.push(...data.collection.products.edges.map(({ node }) => mapShopifyProduct(node)));
        after = data.collection.products.pageInfo.hasNextPage
          ? data.collection.products.pageInfo.endCursor || undefined
          : undefined;
      } while (after);
      if (foundCollection) return publicProducts(products);
    }

    const products = await getShopifyProducts();
    return collectionFilter(handle, products);
  } catch (error) {
    if (!allowMockFallback()) throw error;
    console.error('Shopify collection fetch failed, using mock products:', error);
    return collectionFilter(handle, publicProducts(MOCK_PRODUCTS));
  }
}

export async function getBestsellers(limit = 8): Promise<Product[]> {
  if (!hasShopifyConfig()) return publicProducts(mockBestsellers()).slice(0, limit);
  const products = await getAllProducts();
  return products
    .filter((product) => product.isBestseller)
    .concat(products)
    .filter((product, index, list) => list.findIndex((p) => p.id === product.id) === index)
    .slice(0, limit);
}

export async function getNewArrivals(limit = 8): Promise<Product[]> {
  if (!hasShopifyConfig()) return publicProducts(mockNewArrivals()).slice(0, limit);
  const products = await getAllProducts();
  return products.filter((product) => product.isNew).slice(0, limit);
}

export async function getAllCollections(): Promise<Collection[]> {
  if (!hasShopifyConfig()) return publicCollections(MOCK_COLLECTIONS);

  try {
    const shopifyCollections: Collection[] = [];
    let after: string | undefined;
    do {
      const data = await shopifyFetch<CollectionsResponse>({
        query: GET_COLLECTIONS,
        variables: { first: 250, after },
        cache: 'no-store',
      });
      shopifyCollections.push(...data.collections.edges.map(({ node }) => ({
        id: node.id,
        handle: node.handle,
        title: node.title,
        description: node.description,
        image: node.image?.url,
        productCount: 0,
      })));
      after = data.collections.pageInfo.hasNextPage
        ? data.collections.pageInfo.endCursor || undefined
        : undefined;
    } while (after);
    return publicCollections([
      ...shopifyCollections,
      ...MOCK_COLLECTIONS.filter((collection) => !shopifyCollections.some((c) => c.handle === collection.handle)),
    ]);
  } catch (error) {
    if (!allowMockFallback()) throw error;
    console.error('Shopify collections fetch failed, using mock collections:', error);
    return publicCollections(MOCK_COLLECTIONS);
  }
}

// Product pages link to /collections/<category> (breadcrumbs). collectionFilter() already
// lists a category's products, so any category present in the catalogue is a valid collection.
async function categoryCollection(handle: string): Promise<Collection | undefined> {
  const products = await getAllProducts();
  if (!products.some((product) => product.category === handle)) return undefined;
  const title = handle.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return { id: `category-${handle}`, handle, title, productCount: 0 };
}

export async function getCollectionByHandle(handle: string): Promise<Collection | undefined> {
  if (!isPublicCollectionHandle(handle)) return undefined;

  if (hasShopifyConfig()) {
    const collections = await getAllCollections();
    const shopifyCollection = collections.find((collection) => collection.handle === handle);
    if (shopifyCollection) return shopifyCollection;
  }

  const local = mockGetCollection(handle);
  if (local) return local;

  return categoryCollection(handle);
}

/** Average rating and count of approved reviews for one product. */
export async function getReviewStats(productId: string): Promise<{ rating: number; reviewCount: number }> {
  const { createAdminClient } = await import('@/lib/supabase/server');
  const { data, error } = await createAdminClient()
    .from('reviews')
    .select('rating')
    .eq('product_id', productId)
    .eq('approved', true);
  if (error || !data?.length) return { rating: 0, reviewCount: 0 };
  const total = data.reduce((sum, review) => sum + Number(review.rating), 0);
  return { rating: Math.round((total / data.length) * 10) / 10, reviewCount: data.length };
}
