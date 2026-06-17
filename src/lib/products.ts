/**
 * Product data service — abstracts the data source.
 * Currently uses mock data; swap these functions with Shopify API calls
 * when products are ready, without touching any page/component code.
 */
import {
  MOCK_PRODUCTS,
  getProductByHandle as mockGetByHandle,
  getBestsellers as mockBestsellers,
  getNewArrivals as mockNewArrivals,
} from '@/mock/products';
import { MOCK_COLLECTIONS, getCollectionByHandle as mockGetCollection } from '@/mock/collections';
import type { Product, Collection } from '@/types';

export async function getAllProducts(): Promise<Product[]> {
  // TODO: return await shopifyFetch({ query: GET_PRODUCTS, variables: { first: 50 } })
  return MOCK_PRODUCTS;
}

export async function getProductByHandle(handle: string): Promise<Product | undefined> {
  // TODO: return await shopifyFetch({ query: GET_PRODUCT_BY_HANDLE, variables: { handle } })
  return mockGetByHandle(handle);
}

export async function getProductsByCollection(handle: string): Promise<Product[]> {
  // TODO: return await shopifyFetch({ query: GET_COLLECTION_PRODUCTS, variables: { handle, first: 50 } })
  const all = MOCK_PRODUCTS;
  switch (handle) {
    case 'new-arrivals': return all.filter((p) => p.isNew);
    case 'bestsellers': return all.filter((p) => p.isBestseller);
    case 'plus-size': return all.filter((p) => p.tags.includes('plus-size'));
    case 'babydoll': return all.filter((p) => p.category === 'babydoll');
    case 'bodysuits': return all.filter((p) => p.category === 'bodysuit');
    case 'sets': return all.filter((p) => p.category === 'bra-set');
    case 'robes': return all.filter((p) => ['robe', 'chemise'].includes(p.category));
    default: return all;
  }
}

export async function getBestsellers(limit = 8): Promise<Product[]> {
  // TODO: return await shopifyFetch({ query: GET_PRODUCTS, variables: { first: limit, query: 'tag:bestseller' } })
  return mockBestsellers().slice(0, limit);
}

export async function getNewArrivals(limit = 8): Promise<Product[]> {
  // TODO: return await shopifyFetch({ query: GET_PRODUCTS, variables: { first: limit, query: 'tag:new-arrival' } })
  return mockNewArrivals().slice(0, limit);
}

export async function getAllCollections(): Promise<Collection[]> {
  // TODO: return await shopifyFetch({ query: GET_COLLECTIONS, variables: { first: 20 } })
  return MOCK_COLLECTIONS;
}

export async function getCollectionByHandle(handle: string): Promise<Collection | undefined> {
  // TODO: return await shopifyFetch({ query: GET_COLLECTION, variables: { handle } })
  return mockGetCollection(handle);
}
