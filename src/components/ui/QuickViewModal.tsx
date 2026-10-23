'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { X, ShoppingBag, Star, ArrowRight } from 'lucide-react';
import type { Product, ProductVariant } from '@/types';
import { useCartStore } from '@/store/cart';
import { track } from '@/lib/analytics';
import WishlistButton from '@/components/product/WishlistButton';
import { formatMoney, productImage, productImageAlt } from '@/lib/product-display';
import { useAccessibleDialog } from '@/components/ui/useAccessibleDialog';

type Props = { product: Product | null; onClose: () => void };

function isShopifyVariantGid(value?: string) {
  return !!value && value.startsWith('gid://shopify/ProductVariant/');
}

export default function QuickViewModal({ product, onClose }: Props) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useAccessibleDialog(!!product, onClose, closeRef);
  const reduceMotion = useReducedMotion();

  // Reset state whenever product changes
  useEffect(() => {
    const id = window.setTimeout(() => {
      const available = product?.variants.filter((variant) => variant.stock > 0) ?? [];
      const colors = [...new Set(available.map((variant) => variant.color))];
      const sizes = [...new Set(available.map((variant) => variant.size))];
      const initialColor = colors.length === 1 ? colors[0] : null;
      const initialSize = sizes.length === 1 ? sizes[0] : null;
      setSelectedColor(initialColor);
      setSelectedSize(initialSize);
      setSelectedVariant(
        initialColor && initialSize
          ? available.find((variant) => variant.color === initialColor && variant.size === initialSize) ?? null
          : null,
      );
      setActiveImg(0);
      setAdded(false);
    }, 0);
    return () => window.clearTimeout(id);
  }, [product]);

  if (!product) return null;

  const uniqueColors = [...new Map(product.variants.map((v) => [v.color, v])).values()];
  const uniqueSizes = [...new Set(product.variants.map((v) => v.size))];
  const showColorSelector = uniqueColors.length > 1 || uniqueColors[0]?.color.toLowerCase() !== 'default';
  const discountPct = product.compareAtPrice
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : null;

  function resolveVariant(size: string | null, color: string | null) {
    if (!size || !color) return null;
    const variant = product!.variants.find((v) => v.size === size && v.color === color);
    return variant && variant.stock > 0 ? variant : null;
  }

  function handleColor(color: string) {
    setSelectedColor(color);
    const variant = resolveVariant(selectedSize, color);
    setSelectedVariant(variant);
    if (variant) track.variantSelected(product!.id, variant);
  }

  function handleSize(size: string) {
    const v = resolveVariant(size, selectedColor);
    if (!selectedColor ? product!.variants.some((va) => va.size === size && va.stock > 0) : v && v.stock > 0) {
      setSelectedSize(size);
      setSelectedVariant(v);
      if (v) track.variantSelected(product!.id, v);
    }
  }

  function isColorAvailable(color: string) {
    return product!.variants.some((v) => v.color === color && v.stock > 0 && (!selectedSize || v.size === selectedSize));
  }

  function isSizeAvailable(size: string) {
    if (selectedColor) {
      const v = product!.variants.find((va) => va.size === size && va.color === selectedColor);
      return v ? v.stock > 0 : false;
    }
    return product!.variants.some((v) => v.size === size && v.stock > 0);
  }

  function handleAddToCart() {
    if (!selectedVariant) return;
    addItem({
      variantId: selectedVariant.id,
      productId: product!.id,
      productHandle: product!.handle,
      title: product!.title,
      image: productImage(product!),
      price: selectedVariant.price ?? product!.price,
      currency: selectedVariant.currency ?? product!.currency ?? 'USD',
      stock: selectedVariant.stock,
      size: selectedVariant.size,
      color: selectedVariant.color,
      colorHex: selectedVariant.colorHex,
      quantity: 1,
      shopifyVariantId: isShopifyVariantGid(selectedVariant.shopifyVariantId ?? selectedVariant.id)
        ? selectedVariant.shopifyVariantId ?? selectedVariant.id
        : undefined,
    });
    track.addedToCart(product!, selectedVariant, 1);
    onClose();
  }

  const price = selectedVariant?.price ?? product.price;
  const currency = selectedVariant?.currency ?? product.currency ?? 'USD';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-wine-950/80 px-4 backdrop-blur-sm"
      >
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-view-title"
          tabIndex={-1}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: reduceMotion ? 0 : 0.22 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[min(90dvh,720px)] w-full max-w-3xl overflow-hidden border border-gold-600/20 bg-wine-900 shadow-2xl"
        >
          {/* Close */}
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close quick view"
            className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center text-ivory-dim transition hover:text-gold-400"
          >
            <X size={18} />
          </button>

          {/* Image */}
          <div className="relative hidden w-64 flex-shrink-0 sm:block">
            <div className="relative h-full">
              <Image
                src={productImage(product, activeImg)}
                alt={productImageAlt(product, activeImg)}
                fill
                sizes="256px"
                className="object-cover"
              />
            </div>
            {product.images.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                {product.images.slice(0, 4).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    aria-label={`Show image ${i + 1} of ${Math.min(product.images.length, 4)}`}
                    aria-current={i === activeImg ? 'true' : undefined}
                    className="flex h-11 w-11 items-center justify-center rounded-full"
                  ><span className={`h-2.5 w-2.5 rounded-full ${i === activeImg ? 'bg-gold-400' : 'bg-ivory/30'}`} /></button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
            {showColorSelector && <div>
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gold-400">{product.category}</p>
              <div className="mt-1 flex items-start justify-between gap-3">
                <h2 id="quick-view-title" className="font-serif text-2xl font-light text-ivory">{product.title}</h2>
                <WishlistButton product={product} variant="icon" source="quick_view" className="flex-shrink-0" />
              </div>
              {product.reviewCount > 0 && (
                <div className="mt-2 flex items-center gap-1.5" aria-label={`Rated ${product.rating} out of 5`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={11} className={i < Math.round(product.rating) ? 'fill-gold-400 text-gold-400' : 'text-wine-700'} />
                  ))}
                  <span className="text-xs text-ivory-dim">({product.reviewCount})</span>
                </div>
              )}
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`font-serif text-xl ${product.compareAtPrice ? 'text-crimson-400' : 'text-gold-400'}`}>
                  {formatMoney(price, currency)}
                </span>
                {product.compareAtPrice && (
                  <>
                    <span className="text-sm text-ivory-dim line-through">{formatMoney(product.compareAtPrice, product.currency)}</span>
                    {discountPct && <span className="text-xs font-medium uppercase tracking-[0.08em] text-crimson-400">{discountPct}% off</span>}
                  </>
                )}
              </div>
            </div>}

            {/* Color */}
            <div>
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.1em] text-ivory-muted">
                Color{selectedColor ? ` — ${selectedColor}` : ''}
              </p>
              <div className="flex gap-2">
                {uniqueColors.map((v) => (
                  <button
                    key={v.color}
                    onClick={() => handleColor(v.color)}
                    aria-label={`Color: ${v.color}`}
                    aria-pressed={selectedColor === v.color}
                    disabled={!isColorAvailable(v.color)}
                    className={`h-11 w-11 rounded-full border-8 transition ${
                      selectedColor === v.color ? 'border-gold-400' : 'border-transparent opacity-70 hover:opacity-100'
                    } disabled:opacity-30`}
                    style={{ backgroundColor: v.colorHex }}
                  />
                ))}
              </div>
            </div>

            {/* Size */}
            <div>
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.1em] text-ivory-muted">Size</p>
              <div className="flex flex-wrap gap-1.5">
                {uniqueSizes.map((size) => {
                  const avail = isSizeAvailable(size);
                  return (
                    <button
                      key={size}
                      disabled={!avail}
                      onClick={() => handleSize(size)}
                      aria-pressed={selectedSize === size}
                      className={`min-h-11 min-w-[3rem] border px-3 py-1.5 text-sm font-medium uppercase tracking-[0.08em] transition disabled:cursor-not-allowed ${
                        selectedSize === size
                          ? 'border-gold-400 bg-gold-400 text-wine-950'
                          : avail
                          ? 'border-wine-700 text-ivory-muted hover:border-gold-400 hover:text-gold-400'
                          : 'border-wine-800 text-wine-700 line-through'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ATC */}
            <button
              onClick={handleAddToCart}
              disabled={!selectedVariant}
              className={`flex items-center justify-center gap-2 py-3.5 text-sm font-medium uppercase tracking-[0.1em] transition ${
                added
                  ? 'border border-green-600/50 bg-green-900/30 text-green-400'
                  : selectedVariant
                  ? 'border border-gold-400 text-gold-400 hover:bg-gold-400 hover:text-wine-950'
                  : 'cursor-not-allowed border border-wine-700 text-wine-600'
              }`}
            >
              <ShoppingBag size={13} />
              {added ? 'Added to bag' : selectedVariant ? `Add to bag — ${formatMoney(price, currency)}` : 'Choose options'}
            </button>

            {/* View full details */}
            <Link
              href={`/products/${product.handle}`}
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 text-sm font-medium uppercase tracking-[0.1em] text-ivory-dim transition hover:text-gold-400"
            >
              View full details <ArrowRight size={11} />
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
