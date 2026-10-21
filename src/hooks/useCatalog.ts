'use client';

import { useEffect, useState } from 'react';
import type { Product } from '@/types';

let catalogPromise: Promise<Product[]> | null = null;

export function loadCatalog(): Promise<Product[]> {
  catalogPromise ??= fetch('/api/catalog')
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`catalog ${res.status}`))))
    .then((data: { products: Product[] }) => data.products)
    .catch((error) => {
      catalogPromise = null; // allow a retry on the next use
      console.warn('Catalog load failed:', error);
      return [];
    });
  return catalogPromise;
}

/**
 * The live product catalogue (shared, fetched once per page load). Pass `enabled = false` to
 * defer loading until a feature is actually used, e.g. until the search panel opens.
 */
export function useCatalog(enabled = true) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    loadCatalog().then((loaded) => {
      if (!active) return;
      setProducts(loaded);
      setLoading(false);
    });
    return () => { active = false; };
  }, [enabled]);

  return { products, loading };
}
