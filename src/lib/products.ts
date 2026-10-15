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
  priceRange: { minVariantPrice: ShopifyMoney };
  compareAtPriceRange: { minVariantPrice: ShopifyMoney };
  images: { edges: { node: ShopifyImage }[] };
  tags: string[];
  variants: { edges: { node: ShopifyVariant }[] };
};
type ProductsResponse = {
  products: {
    edges: { node: ShopifyProduct }[];
  };
};
type ProductResponse = {
  product: ShopifyProduct | null;
};
type CollectionsResponse = {
  collections: {
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
    products: { edges: { node: ShopifyProduct }[] };
  } | null;
};

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
  };
}

// The full product list backs listings, related products, search and the catalog API. It
// changes rarely, so it is reused for a few minutes instead of being refetched per request.
// Single product pages still fetch their product live (getProductByHandle).
const PRODUCT_LIST_REVALIDATE_SECONDS = 300;

async function getShopifyProducts(first = 50): Promise<Product[]> {
  const data = await shopifyFetch<ProductsResponse>({
    query: GET_PRODUCTS,
    variables: { first },
    revalidate: PRODUCT_LIST_REVALIDATE_SECONDS,
  });

  return data.products.edges.map(({ node }) => mapShopifyProduct(node));
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
  if (!hasShopifyConfig()) return MOCK_PRODUCTS;

  try {
    return await getShopifyProducts(100);
  } catch (error) {
    console.error('Shopify products fetch failed, using mock products:', error);
    return MOCK_PRODUCTS;
  }
}

export async function getProductByHandle(handle: string): Promise<Product | undefined> {
  if (!hasShopifyConfig()) return mockGetByHandle(handle);

  try {
    const data = await shopifyFetch<ProductResponse>({
      query: GET_PRODUCT_BY_HANDLE,
      variables: { handle },
      cache: 'no-store',
    });
    return data.product ? mapShopifyProduct(data.product) : undefined;
  } catch (error) {
    console.error('Shopify product fetch failed, using mock product:', error);
    return mockGetByHandle(handle);
  }
}

export async function getProductsByCollection(handle: string): Promise<Product[]> {
  if (!hasShopifyConfig()) return collectionFilter(handle, MOCK_PRODUCTS);

  try {
    if (!MOCK_COLLECTIONS.some((collection) => collection.handle === handle)) {
      const data = await shopifyFetch<CollectionProductsResponse>({
        query: GET_COLLECTION_PRODUCTS,
        variables: { handle, first: 100 },
        cache: 'no-store',
      });
      if (data.collection) {
        return data.collection.products.edges.map(({ node }) => mapShopifyProduct(node));
      }
    }

    const products = await getShopifyProducts(100);
    return collectionFilter(handle, products);
  } catch (error) {
    console.error('Shopify collection fetch failed, using mock products:', error);
    return collectionFilter(handle, MOCK_PRODUCTS);
  }
}

export async function getBestsellers(limit = 8): Promise<Product[]> {
  if (!hasShopifyConfig()) return mockBestsellers().slice(0, limit);
  const products = await getAllProducts();
  return products
    .filter((product) => product.isBestseller)
    .concat(products)
    .filter((product, index, list) => list.findIndex((p) => p.id === product.id) === index)
    .slice(0, limit);
}

export async function getNewArrivals(limit = 8): Promise<Product[]> {
  if (!hasShopifyConfig()) return mockNewArrivals().slice(0, limit);
  const products = await getAllProducts();
  return products.filter((product) => product.isNew).slice(0, limit);
}

export async function getAllCollections(): Promise<Collection[]> {
  if (!hasShopifyConfig()) return MOCK_COLLECTIONS;

  try {
    const data = await shopifyFetch<CollectionsResponse>({
      query: GET_COLLECTIONS,
      variables: { first: 50 },
      cache: 'no-store',
    });
    const shopifyCollections = data.collections.edges.map(({ node }) => ({
      id: node.id,
      handle: node.handle,
      title: node.title,
      description: node.description,
      image: node.image?.url,
      productCount: 0,
    }));
    return [...MOCK_COLLECTIONS, ...shopifyCollections.filter((collection) => !MOCK_COLLECTIONS.some((c) => c.handle === collection.handle))];
  } catch (error) {
    console.error('Shopify collections fetch failed, using mock collections:', error);
    return MOCK_COLLECTIONS;
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
  const local = mockGetCollection(handle);
  if (local) return local;

  if (hasShopifyConfig()) {
    const collections = await getAllCollections();
    const shopifyCollection = collections.find((collection) => collection.handle === handle);
    if (shopifyCollection) return shopifyCollection;
  }

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
