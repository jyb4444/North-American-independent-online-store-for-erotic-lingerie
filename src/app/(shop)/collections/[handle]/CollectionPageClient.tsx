'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';
import Breadcrumb from '@/components/ui/Breadcrumb';
import QuickViewModal from '@/components/ui/QuickViewModal';
import type { Collection, Product } from '@/types';
import { useScrollRestore } from '@/hooks/useScrollRestore';

type SortKey = 'default' | 'price-asc' | 'price-desc' | 'rating' | 'newest';
type Props = {
  handle: string;
  collection: Collection;
  baseProducts: Product[];
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'default', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
];

export default function CollectionPageClient({ handle, collection, baseProducts }: Props) {
  const { savePosition } = useScrollRestore(`collection-${handle}`);
  const [sort, setSort] = useState<SortKey>('default');
  const [sortOpen, setSortOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) setSortOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSortOpen(false);
    }

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const products = useMemo(() => {
    let list = [...baseProducts];

    switch (sort) {
      case 'price-asc': list.sort((a, b) => a.price - b.price); break;
      case 'price-desc': list.sort((a, b) => b.price - a.price); break;
      case 'rating': list.sort((a, b) => b.rating - a.rating); break;
      case 'newest': list = list.filter((p) => p.isNew).concat(list.filter((p) => !p.isNew)); break;
    }

    return list;
  }, [baseProducts, sort]);

  const selectedSortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Featured';

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <Breadcrumb crumbs={[
        { label: 'Home', href: '/' },
        { label: 'Shop All', href: '/collections/all' },
        { label: collection.title },
      ]} />

      <div className="mb-8 flex items-end justify-between gap-5">
        <div>
          <h1 className="font-serif text-3xl font-light text-ivory">{collection.title}</h1>
          {collection.description && <p className="mt-1 text-sm text-ivory-muted">{collection.description}</p>}
          <p className="mt-1 text-xs text-ivory-dim">{products.length} products</p>
        </div>

        <div ref={sortMenuRef} className="relative w-56 shrink-0">
          <button
            type="button"
            onClick={() => setSortOpen((open) => !open)}
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
            aria-controls="collection-sort-options"
            className={`flex w-full items-center justify-between border bg-wine-900 px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.18em] transition ${
              sortOpen
                ? 'border-gold-400 text-gold-400'
                : 'border-wine-700 text-ivory-muted hover:border-gold-400/60 hover:text-gold-400'
            }`}
          >
            <span>{selectedSortLabel}</span>
            <ChevronDown
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 transition-transform duration-200 ${sortOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {sortOpen && (
            <div
              id="collection-sort-options"
              role="listbox"
              aria-label="Sort products"
              className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-full border border-gold-600/30 bg-wine-950 p-1.5 shadow-2xl"
            >
              {SORT_OPTIONS.map((option) => {
                const selected = option.value === sort;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setSort(option.value);
                      setSortOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-xs uppercase tracking-[0.14em] transition ${
                      selected
                        ? 'bg-gold-400 text-wine-950'
                        : 'text-ivory-muted hover:bg-wine-800 hover:text-gold-400'
                    }`}
                  >
                    <span>{option.label}</span>
                    {selected && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {products.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center border border-gold-600/20 bg-wine-900 text-center">
          <p className="font-serif text-xl font-light italic text-ivory-muted">No products are available in this collection</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <div key={product.id} onClick={savePosition}>
                <ProductCard product={product} onQuickView={setQuickViewProduct} />
              </div>
            ))}
          </div>
          <QuickViewModal product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
        </>
      )}
    </div>
  );
}
