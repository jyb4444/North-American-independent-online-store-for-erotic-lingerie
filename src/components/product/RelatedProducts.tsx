'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { MOCK_PRODUCTS } from '@/mock/products';
import ProductCard from '@/components/product/ProductCard';
import type { Product } from '@/types';

type Props = { product: Product };

export default function RelatedProducts({ product }: Props) {
  const related = useMemo(() => {
    // 1. Same category
    // 2. Shared tags
    // Exclude current product, limit to 4
    const scored = MOCK_PRODUCTS.filter((p) => p.id !== product.id).map((p) => {
      let score = 0;
      if (p.category === product.category) score += 3;
      const sharedTags = p.tags.filter((t) => product.tags.includes(t)).length;
      score += sharedTags;
      return { product: p, score };
    });
    return scored
      .sort((a, b) => b.score - a.score || b.product.rating - a.product.rating)
      .slice(0, 4)
      .map((s) => s.product);
  }, [product]);

  if (related.length === 0) return null;

  return (
    <section className="mt-16 border-t border-gold-600/20 pt-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">You May Also Like</p>
          <h2 className="font-serif text-2xl font-light text-ivory">Complete the Look</h2>
        </div>
        <Link
          href="/collections/all"
          className="text-xs uppercase tracking-widest text-ivory-muted transition hover:text-gold-400"
        >
          Shop All →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
        {related.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
