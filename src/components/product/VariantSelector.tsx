'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product, ProductVariant } from '@/types';
import { track } from '@/lib/analytics';
import SizeGuideModal from '@/components/ui/SizeGuideModal';
import RestockAlertForm from '@/components/product/RestockAlertForm';

type Props = {
  product: Product;
  onVariantChange: (variant: ProductVariant | null) => void;
  onSelectionChange?: (selection: { size: string | null; color: string | null }) => void;
};

export default function VariantSelector({ product, onVariantChange, onSelectionChange }: Props) {
  const sizes = [...new Set(product.variants.map((v) => v.size))];
  const colors = [...new Map(product.variants.map((v) => [v.color, v])).values()];
  const onlyColor = colors.length === 1 ? colors[0].color : null;
  const onlySize = sizes.length === 1 ? sizes[0] : null;
  const showColorSelector = colors.length > 1 || onlyColor?.toLowerCase() !== 'default';

  const [selectedSize, setSelectedSize] = useState<string | null>(() => (
    onlySize && product.variants.some((variant) => variant.size === onlySize && variant.stock > 0)
      ? onlySize
      : null
  ));
  const [selectedColor, setSelectedColor] = useState<string | null>(() => (
    onlyColor && product.variants.some((variant) => variant.color === onlyColor && variant.stock > 0)
      ? onlyColor
      : null
  ));
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [restockVariant, setRestockVariant] = useState<ProductVariant | null>(null);
  const [selectionMessage, setSelectionMessage] = useState('');

  function resolve(size: string | null, color: string | null) {
    if (!size || !color) return null;
    return product.variants.find((v) => v.size === size && v.color === color && v.stock > 0) ?? null;
  }

  const currentVariant = resolve(selectedSize, selectedColor);
  const stockCount = currentVariant?.stock ?? null;

  useEffect(() => {
    onVariantChange(currentVariant);
    onSelectionChange?.({ size: selectedSize, color: selectedColor });
  }, [currentVariant, onSelectionChange, onVariantChange, selectedColor, selectedSize]);

  function handleSize(size: string) {
    if (!selectedColor && colors.length > 1) {
      setRestockVariant(null);
      setSelectionMessage('Choose a colour before selecting a size or requesting a restock alert.');
      return;
    }
    setSelectionMessage('');
    const availableForSelection = selectedColor ? isAvailable(size, selectedColor) : hasAnyStock(size);
    if (!availableForSelection) {
      const unavailable = product.variants.find((variant) =>
        variant.size === size && (!selectedColor || variant.color === selectedColor));
      setRestockVariant(unavailable ?? null);
      return;
    }
    setRestockVariant(null);
    setSelectedSize(size);
    const color = selectedColor && isAvailable(size, selectedColor) ? selectedColor : null;
    if (selectedColor && !color) setSelectedColor(null);
    const variant = resolve(size, color);
    if (variant) track.variantSelected(product.id, variant);
  }

  function handleColor(color: string) {
    setSelectionMessage('');
    const colorHasStock = product.variants.some((variant) => variant.color === color && variant.stock > 0);
    if (!colorHasStock) {
      setSelectedColor(color);
      setSelectedSize(null);
      setRestockVariant(null);
      return;
    }
    setRestockVariant(null);
    setSelectedColor(color);
    const size = selectedSize && isAvailable(selectedSize, color) ? selectedSize : null;
    if (selectedSize && !size) setSelectedSize(null);
    const variant = resolve(size, color);
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
      {showColorSelector && <div>
        <p className="mb-3 text-sm font-medium uppercase tracking-[0.1em] text-ivory-muted">
          Color{selectedColor ? ` — ${selectedColor}` : ''}
        </p>
        <div className="flex gap-3">
          {colors.map((v) => (
            <motion.button
              key={v.color}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleColor(v.color)}
              aria-disabled={!product.variants.some((variant) => variant.color === v.color && variant.stock > 0)}
              aria-label={v.color}
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
      </div>}

      {/* Size */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium uppercase tracking-[0.1em] text-ivory-muted">Size</p>
          <button onClick={() => setSizeGuideOpen(true)}
            className="text-sm font-medium text-gold-400 underline underline-offset-2 hover:text-gold-500 transition">
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
                aria-label={available ? `Select size ${size}` : `Request a restock alert for size ${size}`}
                title={available ? `Select size ${size}` : `Size ${size} is out of stock — select to request an alert`}
                className={`min-h-11 min-w-[3rem] border px-4 py-2 text-sm font-medium uppercase tracking-[0.08em] transition ${
                  active
                    ? 'border-gold-400 bg-gold-400 text-wine-950'
                    : available
                    ? 'border-wine-700 text-ivory-muted hover:border-gold-400 hover:text-gold-400'
                    : 'border-wine-800 text-wine-700 line-through hover:border-gold-600 hover:text-ivory-muted'
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
        {selectionMessage && <p className="mt-3 text-sm text-gold-400" role="status">{selectionMessage}</p>}

        {/* Low-stock indicator */}
        <AnimatePresence>
          {stockCount !== null && stockCount > 0 && stockCount <= 10 && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className={`mt-3 text-sm font-medium ${
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

        {process.env.NEXT_PUBLIC_RESTOCK_ALERTS_ENABLED === 'true' && restockVariant && (
          <RestockAlertForm productId={product.id} productHandle={product.handle} size={restockVariant.size} color={restockVariant.color} />
        )}

      </div>
    </div>
  );
}
