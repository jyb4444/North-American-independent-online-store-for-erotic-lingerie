'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, Check, ChevronDown } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';
import Breadcrumb from '@/components/ui/Breadcrumb';
import QuickViewModal from '@/components/ui/QuickViewModal';
import type { Collection, Product } from '@/types';
import { useScrollRestore } from '@/hooks/useScrollRestore';

type SortKey = 'default' | 'price-asc' | 'price-desc' | 'newest';
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
      case 'newest': list = list.filter((p) => p.isNew).concat(list.filter((p) => !p.isNew)); break;
    }

    return list;
  }, [baseProducts, sort]);

  const selectedSortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Featured';

  return (
    <div>
      <section className="border-b border-wine-700/70 bg-wine-900/60">
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 sm:pb-14 sm:pt-10 lg:px-8">
          <Breadcrumb crumbs={[
            { label: 'Home', href: '/' },
            { label: 'Shop All', href: '/collections/all' },
            ...(handle === 'all' ? [] : [{ label: collection.title }]),
          ]} />

          <div className="mt-8 max-w-2xl sm:mt-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-ivory-dim">
              The Self Love collection
            </p>
            <h1 className="mt-3 font-serif text-4xl font-light leading-none text-ivory sm:text-5xl lg:text-6xl">
              {collection.title}
            </h1>
            {collection.description && (
              <p className="mt-4 max-w-xl text-sm leading-6 text-ivory-muted sm:text-base">
                {collection.description}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-24">
        <div className="mb-7 flex min-h-20 items-center justify-between gap-4 border-b border-wine-700/70 sm:mb-9">
          <p aria-live="polite" className="text-xs uppercase tracking-[0.18em] text-ivory-dim">
            <span className="font-medium text-ivory">{products.length}</span>{' '}
            {products.length === 1 ? 'style' : 'styles'}
          </p>

          <div ref={sortMenuRef} className="relative w-52 shrink-0 sm:w-60">
            <button
              type="button"
              onClick={() => setSortOpen((open) => !open)}
              aria-label={selectedSortLabel}
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
              aria-controls="collection-sort-options"
              className={`group flex w-full items-center justify-between gap-3 bg-transparent py-4 text-left transition ${
                sortOpen
                  ? 'text-ivory'
                  : 'text-ivory-muted hover:text-ivory'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <ArrowDownUp aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                <span className="truncate text-[11px] font-medium uppercase tracking-[0.18em]">
                  <span className="hidden text-ivory-dim sm:inline">Sort by&nbsp;&nbsp;</span>
                  {selectedSortLabel}
                </span>
              </span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-wine-700 transition group-hover:border-wine-600">
                <ChevronDown
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${sortOpen ? 'rotate-180' : ''}`}
                  strokeWidth={1.5}
                />
              </span>
            </button>

            {sortOpen && (
              <div
                id="collection-sort-options"
                role="listbox"
                aria-label="Sort products"
                className="absolute right-0 top-[calc(100%-0.25rem)] z-30 w-full overflow-hidden rounded-sm border border-wine-700 bg-wine-950 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.14)]"
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
                      className={`flex w-full items-center justify-between px-3.5 py-3 text-left text-[11px] uppercase tracking-[0.14em] transition ${
                        selected
                          ? 'bg-wine-800 font-medium text-ivory'
                          : 'text-ivory-muted hover:bg-wine-900 hover:text-ivory'
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
          <div className="flex h-64 flex-col items-center justify-center border border-wine-700 bg-wine-900 text-center">
            <p className="font-serif text-xl font-light italic text-ivory-muted">No products are available in this collection</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-10 sm:gap-x-5 sm:gap-y-12 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-14">
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
    </div>
  );
}
