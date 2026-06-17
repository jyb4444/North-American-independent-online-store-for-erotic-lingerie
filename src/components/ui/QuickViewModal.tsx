'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { X, ShoppingBag, Star, ArrowRight } from 'lucide-react';
import type { Product, ProductVariant } from '@/types';
import { useCartStore } from '@/store/cart';
import { track } from '@/lib/analytics';
import WishlistButton from '@/components/product/WishlistButton';

type Props = { product: Product | null; onClose: () => void };

export default function QuickViewModal({ product, onClose }: Props) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  // Reset state whenever product changes
  useEffect(() => {
    setSelectedVariant(null);
    setSelectedColor(null);
    setSelectedSize(null);
    setActiveImg(0);
    setAdded(false);
  }, [product?.id]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!product) return null;

  const uniqueColors = [...new Map(product.variants.map((v) => [v.color, v])).values()];
  const uniqueSizes = [...new Set(product.variants.map((v) => v.size))];
  const discountPct = product.compareAtPrice
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : null;

  function resolveVariant(size: string | null, color: string | null) {
    if (!size || !color) return null;
    return product!.variants.find((v) => v.size === size && v.color === color) ?? null;
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
    return product!.variants.some((v) => v.color === color && v.stock > 0);
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
      title: product!.title,
      image: product!.images[0],
      price: product!.price,
      size: selectedVariant.size,
      color: selectedVariant.color,
      colorHex: selectedVariant.colorHex,
      quantity: 1,
    });
    track.addedToCart(product!, selectedVariant, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-wine-950/80 px-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.22 }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex w-full max-w-3xl overflow-hidden border border-gold-600/20 bg-wine-900 shadow-2xl"
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-10 text-ivory-dim transition hover:text-gold-400"
          >
            <X size={18} />
          </button>

          {/* Image */}
          <div className="relative hidden w-64 flex-shrink-0 sm:block">
            <div className="relative h-full">
              <Image
                src={product.images[activeImg] ?? product.images[0]}
                alt={product.title}
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
                    className={`h-1.5 w-1.5 rounded-full transition ${i === activeImg ? 'bg-gold-400' : 'bg-ivory/30'}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-gold-400">{product.category}</p>
              <div className="mt-1 flex items-start justify-between gap-3">
                <h2 className="font-serif text-2xl font-light text-ivory">{product.title}</h2>
                <WishlistButton product={product} variant="icon" source="quick_view" className="flex-shrink-0" />
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={11} className={i < Math.round(product.rating) ? 'fill-gold-400 text-gold-400' : 'text-wine-700'} />
                ))}
                <span className="text-[11px] text-ivory-dim">({product.reviewCount})</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`font-serif text-xl ${product.compareAtPrice ? 'text-crimson-400' : 'text-gold-400'}`}>
                  ${product.price.toFixed(2)}
                </span>
                {product.compareAtPrice && (
                  <>
                    <span className="text-sm text-ivory-dim line-through">${product.compareAtPrice.toFixed(2)}</span>
                    {discountPct && <span className="text-[10px] uppercase tracking-widest text-crimson-400">{discountPct}% off</span>}
                  </>
                )}
              </div>
            </div>

            {/* Color */}
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-ivory-muted">
                Color{selectedColor ? ` — ${selectedColor}` : ''}
              </p>
              <div className="flex gap-2">
                {uniqueColors.map((v) => (
                  <button
                    key={v.color}
                    onClick={() => handleColor(v.color)}
                    title={v.color}
                    disabled={!isColorAvailable(v.color)}
                    className={`h-6 w-6 rounded-full border-2 transition ${
                      selectedColor === v.color ? 'border-gold-400' : 'border-transparent opacity-70 hover:opacity-100'
                    } disabled:opacity-30`}
                    style={{ backgroundColor: v.colorHex }}
                  />
                ))}
              </div>
            </div>

            {/* Size */}
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-ivory-muted">Size</p>
              <div className="flex flex-wrap gap-1.5">
                {uniqueSizes.map((size) => {
                  const avail = isSizeAvailable(size);
                  return (
                    <button
                      key={size}
                      onClick={() => handleSize(size)}
                      className={`min-w-[2.5rem] border px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest transition ${
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
              className={`flex items-center justify-center gap-2 py-3 text-xs font-medium uppercase tracking-widest transition ${
                added
                  ? 'border border-green-600/50 bg-green-900/30 text-green-400'
                  : selectedVariant
                  ? 'border border-gold-400 text-gold-400 hover:bg-gold-400 hover:text-wine-950'
                  : 'cursor-not-allowed border border-wine-700 text-wine-600'
              }`}
            >
              <ShoppingBag size={13} />
              {added ? 'Added to Bag' : selectedVariant ? 'Add to Bag' : 'Select Size & Color'}
            </button>

            {/* View full details */}
            <Link
              href={`/products/${product.handle}`}
              onClick={onClose}
              className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-widest text-ivory-dim transition hover:text-gold-400"
            >
              View full details <ArrowRight size={11} />
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
