'use client';

import { useCallback, useEffect, useState } from 'react';
import ProductGallery from '@/components/product/ProductGallery';
import VariantSelector from '@/components/product/VariantSelector';
import WishlistButton from '@/components/product/WishlistButton';
import { useCartStore } from '@/store/cart';
import { track } from '@/lib/analytics';
import type { Product, ProductVariant } from '@/types';
import { ShoppingBag, Star, Share2, Check } from 'lucide-react';
import ReviewSection from '@/components/product/ReviewSection';
import RelatedProducts from '@/components/product/RelatedProducts';
import Breadcrumb from '@/components/ui/Breadcrumb';
import RecentlyViewedSection from '@/components/ui/RecentlyViewedSection';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';

type Props = {
  product: Product;
  relatedProducts: Product[];
};

function isShopifyVariantGid(value?: string) {
  return !!value && value.startsWith('gid://shopify/ProductVariant/');
}

export default function ProductPageClient({ product, relatedProducts }: Props) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selection, setSelection] = useState<{ size: string | null; color: string | null }>({ size: null, color: null });
  const { recordView } = useRecentlyViewed();
  const addItem = useCartStore((s) => s.addItem);
  const displayedPrice = selectedVariant?.price ?? product.price;
  const quantityLimit = selectedVariant ? Math.min(99, selectedVariant.stock) : 99;

  const handleVariantChange = useCallback((variant: ProductVariant | null) => {
    setSelectedVariant(variant);
    setQuantity((current) => variant ? Math.min(current, variant.stock) : 1);
  }, []);

  useEffect(() => {
    recordView(product.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: product.title, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleAddToCart() {
    if (!selectedVariant || selectedVariant.stock <= 0) return;
    const safeQuantity = Math.min(quantity, selectedVariant.stock);
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productHandle: product.handle,
      title: product.title,
      image: product.images[0],
      price: displayedPrice,
      currency: selectedVariant.currency ?? product.currency ?? 'USD',
      stock: selectedVariant.stock,
      size: selectedVariant.size,
      color: selectedVariant.color,
      colorHex: selectedVariant.colorHex,
      quantity: safeQuantity,
      shopifyVariantId: isShopifyVariantGid(selectedVariant.shopifyVariantId ?? selectedVariant.id)
        ? selectedVariant.shopifyVariantId ?? selectedVariant.id
        : undefined,
    });
    track.addedToCart(product, selectedVariant, safeQuantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  const discountPct = product.compareAtPrice && (!selectedVariant || selectedVariant.price === product.price)
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : null;
  const categoryLabel = product.category.charAt(0).toUpperCase() + product.category.slice(1);
  const selectionPrompt = !selection.size && !selection.color
    ? 'Select Size & Color'
    : !selection.size
      ? 'Select Size'
      : 'Select Color';

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-14 sm:px-6 md:pb-14">
      <Breadcrumb crumbs={[
        { label: 'Home', href: '/' },
        { label: 'Shop All', href: '/collections/all' },
        { label: categoryLabel, href: `/collections/${product.category}` },
        { label: product.title },
      ]} />
      <div className="grid gap-14 md:grid-cols-2">
        <ProductGallery
          images={product.images}
          video={product.video}
          productId={product.id}
          title={product.title}
          altTexts={product.imageAltTexts}
          modelMeasurements={product.modelMeasurements}
        />

        <div className="flex flex-col gap-7">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-[0.14em] text-gold-400">
              {product.category}
            </p>
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-serif text-4xl font-light text-ivory">{product.title}</h1>
              <div className="mt-1 flex flex-shrink-0 items-center gap-2">
                <button onClick={handleShare} title="Share this product" className="text-ivory-dim transition hover:text-gold-400">
                  {copied ? <Check size={15} className="text-green-400" /> : <Share2 size={15} />}
                </button>
                <WishlistButton product={product} variant="icon" source="product_detail" />
              </div>
            </div>

            {product.reviewCount > 0 ? (
              <div className="mt-3 flex items-center gap-2">
                <div className="flex" aria-label={`Rated ${product.rating} out of 5`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={13}
                      className={i < Math.round(product.rating) ? 'fill-gold-400 text-gold-400' : 'text-wine-700'}
                    />
                  ))}
                </div>
                <span className="text-sm text-ivory-dim">
                  {product.rating} ({product.reviewCount} {product.reviewCount === 1 ? 'review' : 'reviews'})
                </span>
              </div>
            ) : (
              <p className="mt-3 text-sm text-ivory-dim">No reviews yet</p>
            )}

            <div className="mt-5 flex items-baseline gap-3">
              <span className="font-serif text-3xl font-light text-gold-400">${displayedPrice.toFixed(2)}</span>
              {product.compareAtPrice && (
                <span className="text-lg text-ivory-dim line-through">${product.compareAtPrice.toFixed(2)}</span>
              )}
              {discountPct && (
                <span className="border border-crimson-400/50 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.08em] text-crimson-400">
                  {discountPct}% off
                </span>
              )}
            </div>
          </div>

          <div className="h-px bg-gold-600/20" />

          <section className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-ivory">About this item</h2>
              <p className="mt-3 text-base font-normal leading-7 text-ivory-muted">{product.description}</p>
            </div>

            <div className="grid gap-3 border-y border-gold-600/15 py-4 sm:grid-cols-2">
              {product.material && <div>
                <p className="text-sm font-medium uppercase tracking-[0.1em] text-ivory-muted">Material</p>
                <p className="mt-1 text-base leading-7 text-ivory-muted">{product.material}</p>
              </div>}
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.1em] text-ivory-muted">Care</p>
                <p className="mt-1 text-base leading-7 text-ivory-muted">{product.careInstructions}</p>
              </div>
            </div>
          </section>

          <VariantSelector
            product={product}
            onVariantChange={handleVariantChange}
            onSelectionChange={setSelection}
          />

          <div>
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.1em] text-ivory-muted">Quantity</p>
            <div className="flex w-fit items-center gap-4 border border-wine-700 px-5 py-2.5">
              <button aria-label="Decrease quantity" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} className="text-ivory-muted transition hover:text-gold-400 disabled:cursor-not-allowed disabled:opacity-40">-</button>
              <span className="w-5 text-center text-sm text-ivory">{quantity}</span>
              <button aria-label="Increase quantity" onClick={() => setQuantity((q) => Math.min(quantityLimit, q + 1))} disabled={quantity >= quantityLimit} className="text-ivory-muted transition hover:text-gold-400 disabled:cursor-not-allowed disabled:opacity-40">+</button>
            </div>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={!selectedVariant}
            className={`flex items-center justify-center gap-2.5 py-4 text-sm font-medium uppercase tracking-[0.1em] transition ${
              added
                ? 'border border-green-600/50 bg-green-900/30 text-green-400'
                : selectedVariant
                ? 'border border-gold-400 text-gold-400 hover:bg-gold-400 hover:text-wine-950'
                : 'cursor-not-allowed border border-wine-700 text-wine-600'
            }`}
          >
            <ShoppingBag size={15} />
            {added ? 'Added to Bag' : selectedVariant ? 'Add to Bag' : selectionPrompt}
          </button>
        </div>
      </div>

      <RelatedProducts product={product} products={relatedProducts} />
      <ReviewSection productId={product.id} productHandle={product.handle} seedRating={product.rating} seedCount={product.reviewCount} />
      <RecentlyViewedSection excludeId={product.id} />

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gold-600/20 bg-wine-950/95 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ivory">{product.title}</p>
            <p className="font-serif text-base text-gold-400">${displayedPrice.toFixed(2)}</p>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={!selectedVariant}
            className={`flex flex-shrink-0 items-center gap-2 px-5 py-3 text-sm font-medium uppercase tracking-[0.08em] transition ${
              added
                ? 'border border-green-600/50 bg-green-900/30 text-green-400'
                : selectedVariant
                ? 'bg-gold-400 text-wine-950'
                : 'bg-wine-700 text-wine-500'
            }`}
          >
            <ShoppingBag size={14} />
            {added ? 'Added' : selectedVariant ? 'Add to Bag' : selectionPrompt}
          </button>
        </div>
      </div>

    </div>
  );
}
