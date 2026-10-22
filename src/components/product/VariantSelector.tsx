'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product, ProductVariant } from '@/types';
import { track } from '@/lib/analytics';
import SizeGuideModal from '@/components/ui/SizeGuideModal';
import RestockAlertForm from '@/components/product/RestockAlertForm';

type Props = {
  product: Product;
  onVariantChange: (variant: ProductVariant | null) => void;
  preferredSize?: string | null;
};

export default function VariantSelector({ product, onVariantChange, preferredSize }: Props) {
  const sizes = [...new Set(product.variants.map((v) => v.size))];
  const colors = [...new Map(product.variants.map((v) => [v.color, v])).values()];

  const [selectedSize, setSelectedSize] = useState<string | null>(() => (
    preferredSize && product.variants.some((variant) => variant.size === preferredSize && variant.stock > 0)
      ? preferredSize
      : null
  ));
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  function resolve(size: string | null, color: string | null) {
    if (!size || !color) return null;
    return product.variants.find((v) => v.size === size && v.color === color) ?? null;
  }

  const currentVariant = resolve(selectedSize, selectedColor);
  const stockCount = currentVariant?.stock ?? null;

  function handleSize(size: string) {
    setSelectedSize(size);
    const variant = resolve(size, selectedColor);
    onVariantChange(variant);
    if (variant) track.variantSelected(product.id, variant);
  }

  function handleColor(color: string) {
    setSelectedColor(color);
    const variant = resolve(selectedSize, color);
    onVariantChange(variant);
    if (variant) track.variantSelected(product.id, variant);
  }

  function isAvailable(size: string, color: string) {
    const v = product.variants.find((v) => v.size === size && v.color === color);
    return v ? v.stock > 0 : false;
  }

  function hasAnyStock(size: string) {
    return product.variants.some((v) => v.size === size && v.stock > 0);
  }

  return (
    <div className="space-y-6">
      {/* Color */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-ivory-muted">
          Color{selectedColor ? ` — ${selectedColor}` : ''}
        </p>
        <div className="flex gap-3">
          {colors.map((v) => (
            <motion.button
              key={v.color}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleColor(v.color)}
              title={v.color}
              className={`h-7 w-7 rounded-full border-2 transition ${
                selectedColor === v.color
                  ? 'border-gold-400 ring-1 ring-gold-400/30 ring-offset-1 ring-offset-wine-900'
                  : 'border-wine-700 hover:border-gold-600'
              }`}
              style={{ backgroundColor: v.colorHex }}
            />
          ))}
        </div>
      </div>

      {/* Size */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-ivory-muted">Size</p>
          <button onClick={() => setSizeGuideOpen(true)}
            className="text-xs text-gold-400/70 underline underline-offset-2 hover:text-gold-400 transition">
            Size Guide
          </button>
          <SizeGuideModal open={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {sizes.map((size) => {
            const available = selectedColor ? isAvailable(size, selectedColor) : hasAnyStock(size);
            const active = selectedSize === size;
            return (
              <button
                key={size}
                onClick={() => handleSize(size)}
                aria-disabled={!available}
                title={available ? `Select size ${size}` : `Size ${size} is out of stock`}
                className={`min-w-[3rem] border px-4 py-2 text-xs font-medium uppercase tracking-widest transition ${
                  active
                    ? 'border-gold-400 bg-gold-400 text-wine-950'
                    : available
                    ? 'border-wine-700 text-ivory-muted hover:border-gold-400 hover:text-gold-400'
                    : 'cursor-not-allowed border-wine-800 text-wine-700 line-through'
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>

        {/* Low-stock indicator */}
        <AnimatePresence>
          {stockCount !== null && stockCount > 0 && stockCount <= 10 && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={`mt-3 text-xs font-medium ${
                stockCount <= 3
                  ? 'text-crimson-400'
                  : 'text-ivory-muted'
              }`}
            >
              {stockCount <= 3
                ? `Only ${stockCount} left — order soon`
                : `Only ${stockCount} left in this size & colour`}
            </motion.p>
          )}
        </AnimatePresence>

        {process.env.NEXT_PUBLIC_RESTOCK_ALERTS_ENABLED === 'true' && currentVariant && currentVariant.stock <= 0 && (
          <RestockAlertForm productId={product.id} productHandle={product.handle} size={currentVariant.size} color={currentVariant.color} />
        )}

      </div>
    </div>
  );
}
