'use client';

import { use, useState, useMemo } from 'react';
import { notFound } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';
import Breadcrumb from '@/components/ui/Breadcrumb';
import QuickViewModal from '@/components/ui/QuickViewModal';
import { MOCK_PRODUCTS } from '@/mock/products';
import { getCollectionByHandle } from '@/mock/collections';
import type { Product } from '@/types';
import { useScrollRestore } from '@/hooks/useScrollRestore';

type SortKey = 'default' | 'price-asc' | 'price-desc' | 'rating' | 'newest';
type Props = { params: Promise<{ handle: string }> };

function getProducts(handle: string) {
  switch (handle) {
    case 'all': return MOCK_PRODUCTS;
    case 'new-arrivals': return MOCK_PRODUCTS.filter((p) => p.isNew);
    case 'discount': return MOCK_PRODUCTS.filter((p) => !!p.compareAtPrice);
    case 'first-free': return MOCK_PRODUCTS.slice(0, 4);
    case 'bestsellers': return MOCK_PRODUCTS.filter((p) => p.isBestseller);
    case 'plus-size': return MOCK_PRODUCTS.filter((p) => p.tags.includes('plus-size'));
    case 'babydoll': return MOCK_PRODUCTS.filter((p) => p.category === 'babydoll');
    case 'bodysuits': return MOCK_PRODUCTS.filter((p) => ['bodysuit', 'bodystocking'].includes(p.category));
    case 'sets': return MOCK_PRODUCTS.filter((p) => ['corset', 'bra-set', 'panty', 'babydoll', 'teddy'].includes(p.category));
    case 'robes': return MOCK_PRODUCTS.filter((p) => ['robe', 'chemise'].includes(p.category));
    case 'hosiery': return MOCK_PRODUCTS.filter((p) => p.category === 'hosiery');
    default: return MOCK_PRODUCTS;
  }
}

export default function CollectionPage({ params }: Props) {
  const { handle } = use(params);
  const collection = getCollectionByHandle(handle);
  if (!collection) notFound();

  const baseProducts = getProducts(handle);

  // All available colors across all products
  const allColors = useMemo(() => {
    const map = new Map<string, string>();
    baseProducts.forEach((p) =>
      p.variants.forEach((v) => map.set(v.color, v.colorHex))
    );
    return Array.from(map.entries());
  }, [baseProducts]);

  const { savePosition } = useScrollRestore(`collection-${handle}`);
  const [sort, setSort] = useState<SortKey>('default');
  const [filterColor, setFilterColor] = useState<string | null>(null);
  const [filterDiscount, setFilterDiscount] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const products = useMemo(() => {
    let list = [...baseProducts];

    if (filterColor) list = list.filter((p) => p.variants.some((v) => v.color === filterColor));
    if (filterDiscount) list = list.filter((p) => !!p.compareAtPrice);

    switch (sort) {
      case 'price-asc': list.sort((a, b) => a.price - b.price); break;
      case 'price-desc': list.sort((a, b) => b.price - a.price); break;
      case 'rating': list.sort((a, b) => b.rating - a.rating); break;
      case 'newest': list = list.filter((p) => p.isNew).concat(list.filter((p) => !p.isNew)); break;
    }

    return list;
  }, [baseProducts, sort, filterColor, filterDiscount]);

  const activeFilters = (filterColor ? 1 : 0) + (filterDiscount ? 1 : 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <Breadcrumb crumbs={[
        { label: 'Home', href: '/' },
        { label: 'Shop All', href: '/collections/all' },
        { label: collection.title },
      ]} />
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl font-light text-ivory">{collection.title}</h1>
          {collection.description && (
            <p className="mt-1 text-sm text-ivory-muted">{collection.description}</p>
          )}
          <p className="mt-1 text-xs text-ivory-dim">{products.length} products</p>
        </div>

        {/* Sort + Filter toggle */}
        <div className="flex items-center gap-3">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="border border-wine-700 bg-wine-900 px-3 py-2 text-xs uppercase tracking-widest text-ivory-muted focus:border-gold-400 focus:outline-none transition"
          >
            <option value="default">Featured</option>
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="rating">Top Rated</option>
          </select>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 border px-3 py-2 text-xs uppercase tracking-widest transition ${
              showFilters || activeFilters > 0
                ? 'border-gold-400 text-gold-400'
                : 'border-wine-700 text-ivory-muted hover:border-gold-400/50 hover:text-gold-400'
            }`}
          >
            <SlidersHorizontal size={13} />
            Filter{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-8 border border-gold-600/20 bg-wine-900 px-5 py-4">
          <div className="flex flex-wrap items-center gap-6">
            {/* Color filter */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-ivory-muted">Color</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterColor(null)}
                  className={`border px-3 py-1 text-xs transition ${!filterColor ? 'border-gold-400 text-gold-400' : 'border-wine-700 text-ivory-dim hover:border-gold-400/50'}`}
                >
                  All
                </button>
                {allColors.map(([color, hex]) => (
                  <button
                    key={color}
                    onClick={() => setFilterColor(filterColor === color ? null : color)}
                    title={color}
                    className={`h-6 w-6 rounded-full border-2 transition ${
                      filterColor === color ? 'border-gold-400 ring-1 ring-gold-400/30' : 'border-transparent hover:border-white/30'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>

            {/* Discount filter */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest text-ivory-muted">Offer</p>
              <button
                onClick={() => setFilterDiscount((v) => !v)}
                className={`border px-3 py-1 text-xs transition ${filterDiscount ? 'border-gold-400/50 text-gold-400' : 'border-wine-700 text-ivory-dim hover:border-gold-400/50'}`}
              >
                Discount
              </button>
            </div>

            {/* Clear */}
            {activeFilters > 0 && (
              <button
                onClick={() => { setFilterColor(null); setFilterDiscount(false); }}
                className="text-xs text-ivory-dim underline hover:text-gold-400 transition"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Grid */}
      {products.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center border border-gold-600/20 bg-wine-900 text-center">
          <p className="font-serif text-xl font-light italic text-ivory-muted">No products match your filters</p>
          <button onClick={() => { setFilterColor(null); setFilterDiscount(false); }}
            className="mt-4 text-xs uppercase tracking-widest text-gold-400 hover:underline transition">
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <div key={product.id} onClick={savePosition}>
                <ProductCard
                  product={product}
                  onQuickView={setQuickViewProduct}
                />
              </div>
            ))}
          </div>
          <QuickViewModal product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
        </>
      )}
    </div>
  );
}
