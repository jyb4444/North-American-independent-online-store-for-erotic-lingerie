'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import type { Product, ProductVariant } from '@/types';
import { track } from '@/lib/analytics';
import SizeGuideModal from '@/components/ui/SizeGuideModal';

type Props = {
  product: Product;
  onVariantChange: (variant: ProductVariant | null) => void;
};

type NotifyState = 'idle' | 'sending' | 'success' | 'error';

export default function VariantSelector({ product, onVariantChange }: Props) {
  const sizes = [...new Set(product.variants.map((v) => v.size))];
  const colors = [...new Map(product.variants.map((v) => [v.color, v])).values()];

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  const [notifySize, setNotifySize] = useState<string | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyState, setNotifyState] = useState<NotifyState>('idle');
  const [notifyError, setNotifyError] = useState('');

  function resolve(size: string | null, color: string | null) {
    if (!size || !color) return null;
    return product.variants.find((v) => v.size === size && v.color === color) ?? null;
  }

  const currentVariant = resolve(selectedSize, selectedColor);
  const stockCount = currentVariant?.stock ?? null;

  function handleSize(size: string) {
    const available = selectedColor ? isAvailable(size, selectedColor) : hasAnyStock(size);
    if (!available) {
      setNotifySize(size === notifySize ? null : size);
      setNotifyState('idle');
      setNotifyError('');
      return;
    }
    setNotifySize(null);
    setSelectedSize(size);
    const variant = resolve(size, selectedColor);
    onVariantChange(variant);
    if (variant) track.variantSelected(product.id, variant);
  }

  function handleColor(color: string) {
    setNotifySize(null);
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

  async function handleNotifySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!notifySize) return;
    setNotifyState('sending');
    setNotifyError('');

    const color = selectedColor ?? colors[0]?.color ?? '';

    try {
      const res = await fetch('/api/restock-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: notifyEmail,
          product_id: product.id,
          product_handle: product.handle,
          size: notifySize,
          color,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Failed to register alert');
      }
      setNotifyState('success');
    } catch (err) {
      setNotifyState('error');
      setNotifyError(err instanceof Error ? err.message : 'Something went wrong.');
    }
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
            const isNotifyTarget = notifySize === size;
            return (
              <button
                key={size}
                onClick={() => handleSize(size)}
                className={`min-w-[3rem] border px-4 py-2 text-xs font-medium uppercase tracking-widest transition ${
                  active
                    ? 'border-gold-400 bg-gold-400 text-wine-950'
                    : available
                    ? 'border-wine-700 text-ivory-muted hover:border-gold-400 hover:text-gold-400'
                    : isNotifyTarget
                    ? 'border-gold-400/40 text-ivory-dim'
                    : 'border-wine-800 text-wine-700 line-through'
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

        {/* Notify me panel */}
        <AnimatePresence>
          {notifySize && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 border border-gold-600/20 bg-wine-900 p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Bell size={13} className="text-gold-400 flex-shrink-0" />
                    <p className="text-xs text-ivory-muted">
                      <strong className="text-ivory">Size {notifySize}</strong> is currently out of stock.
                      Enter your email to be notified privately when it returns.
                    </p>
                  </div>
                  <button onClick={() => setNotifySize(null)} className="text-ivory-dim hover:text-gold-400 transition flex-shrink-0">
                    <X size={13} />
                  </button>
                </div>

                {notifyState === 'success' ? (
                  <p className="text-xs text-green-400">
                    You&rsquo;re on the list. We&rsquo;ll notify you privately when size {notifySize} is back.
                  </p>
                ) : (
                  <form onSubmit={handleNotifySubmit} className="flex gap-2">
                    <input
                      type="email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      required
                      placeholder="your@email.com"
                      className="min-w-0 flex-1 border border-wine-700 bg-wine-800 px-3 py-2 text-xs text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
                    />
                    <button
                      type="submit"
                      disabled={notifyState === 'sending'}
                      className="flex-shrink-0 border border-gold-400 px-4 py-2 text-[11px] font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 disabled:cursor-wait disabled:opacity-50"
                    >
                      {notifyState === 'sending' ? '...' : 'Notify Me'}
                    </button>
                  </form>
                )}
                {notifyState === 'error' && notifyError && (
                  <p className="mt-2 text-[11px] text-crimson-400">{notifyError}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
