'use client';

import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import ProductCard from '@/components/product/ProductCard';

export default function RecentlyViewedSection({ excludeId }: { excludeId?: string }) {
  const { products } = useRecentlyViewed(excludeId);

  if (products.length === 0) return null;

  return (
    <section className="mt-16 border-t border-gold-600/20 pt-10">
      <div className="mb-8">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Your History</p>
        <h2 className="font-serif text-2xl font-light text-ivory">Recently Viewed</h2>
      </div>
      <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-6">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
