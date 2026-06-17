'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Product } from '@/types';
import { track } from '@/lib/analytics';
import FitConfidenceBadge from '@/components/product/FitConfidenceBadge';
import WishlistButton from '@/components/product/WishlistButton';

type Props = { product: Product };

export default function ProductCard({ product, onQuickView }: Props & { onQuickView?: (p: Product) => void }) {
  const [hovered, setHovered] = useState(false);
  const uniqueColors = [...new Map(product.variants.map((v) => [v.color, v])).values()];
  const uniqueSizes = [...new Set(product.variants.map((v) => v.size))];
  const discountPct = product.compareAtPrice
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : null;

  function hasSizeStock(size: string) {
    return product.variants.some((v) => v.size === size && v.stock > 0);
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group block"
    >
      {/* Image */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-wine-800">
        <Link href={`/products/${product.handle}`} onClick={() => track.productViewed(product)} className="block h-full">
          <Image
            src={hovered && product.images[1] ? product.images[1] : product.images[0]}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-wine-950/0 transition-colors duration-300 group-hover:bg-wine-950/20" />
        </Link>

        {/* Badges */}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {product.isNew && (
            <span className="bg-gold-400 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-wine-950">
              New
            </span>
          )}
        </div>
        <div className="absolute right-3 top-3 z-10">
          <WishlistButton product={product} variant="icon" source="product_card" />
        </div>

        {/* Size availability chips — appear on hover */}
        <div className={`absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 bg-wine-950/80 px-3 py-2 backdrop-blur-sm transition-all duration-300 ${hovered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}>
          <div className="flex flex-wrap gap-1">
            {uniqueSizes.map((size) => {
              const inStock = hasSizeStock(size);
              return (
                <span
                  key={size}
                  className={`px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${
                    inStock
                      ? 'border border-ivory/30 text-ivory'
                      : 'border border-wine-700/50 text-wine-600 line-through'
                  }`}
                >
                  {size}
                </span>
              );
            })}
          </div>
          {onQuickView && (
            <button
              onClick={(e) => { e.preventDefault(); onQuickView(product); }}
              className="flex-shrink-0 border border-gold-400/60 px-2 py-1 text-[9px] font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
            >
              Quick View
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="mt-3 space-y-1.5">
        <Link
          href={`/products/${product.handle}`}
          onClick={() => track.productViewed(product)}
          className="block text-sm font-light tracking-wide text-ivory transition hover:text-gold-400"
        >
          {product.title}
        </Link>

        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className={product.compareAtPrice ? 'text-sm text-crimson-400' : 'text-sm text-gold-400'}>
            ${product.price.toFixed(2)}
          </span>
          {product.compareAtPrice && (
            <>
              <span className="text-sm text-ivory-dim line-through">
                ${product.compareAtPrice.toFixed(2)}
              </span>
              {discountPct && (
                <span className="text-[10px] uppercase tracking-widest text-crimson-400">
                  {discountPct}% off
                </span>
              )}
            </>
          )}
        </div>

        <FitConfidenceBadge product={product} variant="card" />

        {/* Color swatches */}
        <div className="flex gap-1.5 pt-0.5">
          {uniqueColors.map((v) => (
            <motion.span
              key={v.color}
              whileHover={{ scale: 1.25 }}
              className="h-2.5 w-2.5 rounded-full border border-gold-600/30"
              style={{ backgroundColor: v.colorHex }}
              title={v.color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
