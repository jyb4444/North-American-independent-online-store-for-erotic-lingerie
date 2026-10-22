'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useCatalog } from '@/hooks/useCatalog';
import { useAccessibleDialog } from '@/components/ui/useAccessibleDialog';

type Props = { open: boolean; onClose: () => void };

export default function SearchModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useAccessibleDialog(open, onClose, inputRef);

  useEffect(() => {
    if (!open) return;
    const clearId = window.setTimeout(() => setQuery(''), 0);
    const focusId = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => {
      window.clearTimeout(clearId);
      window.clearTimeout(focusId);
    };
  }, [open]);

  // Loaded when the panel first opens; this is the live (Shopify) catalogue.
  const { products: catalog, loading } = useCatalog(open);

  const q = query.trim().toLowerCase();
  const queryTerms = q.split(/\s+/).filter(Boolean);
  const results = q.length < 2 ? [] : catalog.filter((product) => {
    const searchable = [product.title, product.description, product.category, ...product.tags]
      .join(' ')
      .toLowerCase();
    return queryTerms.every((term) => searchable.includes(term));
  }).slice(0, 8);

  const categoryLinks = [
    { href: '/collections/all', label: 'Shop ALL', description: 'Browse every current style', products: catalog.slice(0, 4) },
    { href: '/sale', label: 'SALES', description: 'Current markdowns', products: catalog.filter((p) => p.compareAtPrice).slice(0, 4) },
    { href: '/collections/hosiery', label: 'Hosiery', description: 'Sheer and statement hosiery', products: catalog.filter((p) => p.category === 'hosiery').slice(0, 4) },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} className="fixed inset-0 z-50 bg-wine-950/70 backdrop-blur-sm" />

          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}
            className="fixed left-0 right-0 top-0 z-50 border-b border-gold-600/20 bg-wine-900 px-4 pb-6 pt-4 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            tabIndex={-1}
          >
            {/* Input */}
            <div className="mx-auto flex max-w-2xl items-center gap-3">
              <Search size={16} className="flex-shrink-0 text-gold-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products, categories, styles…"
                aria-label="Search products"
                className="flex-1 bg-transparent text-base text-ivory placeholder-ivory-dim focus:outline-none"
              />
              <button onClick={onClose} aria-label="Close search" className="flex h-11 w-11 items-center justify-center text-ivory-dim hover:text-gold-400 transition">
                <X size={18} />
              </button>
            </div>

            {/* Results */}
            <div className="mx-auto mt-5 max-w-2xl">
              {q.length >= 2 ? (
                loading ? (
                  <p className="text-sm text-ivory-muted">Searching…</p>
                ) : results.length === 0 ? (
                  <p className="text-sm text-ivory-muted">No results for &quot;{query}&quot;</p>
                ) : (
                  <>
                    <p className="mb-3 text-xs font-medium uppercase tracking-widest text-ivory-dim">
                      {results.length} result{results.length !== 1 ? 's' : ''}
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {results.map((p) => (
                        <Link key={p.id} href={`/products/${p.handle}`} onClick={onClose}
                          className="group flex gap-3 sm:flex-col">
                          <div className="relative h-16 w-12 flex-shrink-0 overflow-hidden bg-wine-800 sm:h-32 sm:w-full">
                            <Image src={p.images[0]} alt={p.title} fill sizes="120px" className="object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs text-ivory group-hover:text-gold-400 transition">{p.title}</p>
                            <p className="text-xs text-gold-400">${p.price.toFixed(2)}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </>
                )
              ) : (
                <>
                  <p className="mb-3 text-xs font-medium uppercase tracking-widest text-ivory-dim">Shop by category</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {categoryLinks.map((category) => (
                      <div key={category.href} className="border border-wine-700 bg-wine-950 p-3">
                        <Link href={category.href} onClick={onClose} className="block transition hover:text-gold-400">
                          <p className="text-xs font-medium uppercase tracking-widest text-ivory">{category.label}</p>
                          <p className="mt-1 text-xs text-ivory-dim">{category.description}</p>
                        </Link>
                        {category.products.length > 0 && (
                          <div className="mt-3 grid grid-cols-4 gap-2">
                            {category.products.map((p) => (
                              <Link key={p.id} href={`/products/${p.handle}`} onClick={onClose} className="group">
                                <div className="relative aspect-[3/4] overflow-hidden bg-wine-800">
                                  <Image src={p.images[0]} alt={p.title} fill sizes="80px" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
