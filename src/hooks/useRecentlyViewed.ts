'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Product } from '@/types';
import { MOCK_PRODUCTS } from '@/mock/products';

const STORAGE_KEY = 'velour_recently_viewed';
const MAX_ITEMS = 8;

export function useRecentlyViewed(excludeId?: string) {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed: string[] = raw ? JSON.parse(raw) : [];
      setIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setIds([]);
    }
  }, []);

  const recordView = useCallback((productId: string) => {
    setIds((prev) => {
      const updated = [productId, ...prev.filter((id) => id !== productId)].slice(0, MAX_ITEMS);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const products: Product[] = ids
    .filter((id) => id !== excludeId)
    .map((id) => MOCK_PRODUCTS.find((p) => p.id === id))
    .filter((p): p is Product => p !== undefined)
    .slice(0, 6);

  return { products, recordView };
}
