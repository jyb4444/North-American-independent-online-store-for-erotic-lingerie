'use client';

import { useEffect, useState } from 'react';
import ProductGallery from '@/components/product/ProductGallery';
import VariantSelector from '@/components/product/VariantSelector';
import WishlistButton from '@/components/product/WishlistButton';
import FitAdvisor from '@/components/product/FitAdvisor';
import FitConfidenceBadge from '@/components/product/FitConfidenceBadge';
import { useCartStore } from '@/store/cart';
import { track } from '@/lib/analytics';
import type { Product, ProductVariant } from '@/types';
import { ShoppingBag, Star, Sparkles, Share2, Check } from 'lucide-react';
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

function productDetailBullets(description: string) {
  return description
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 24)
    .slice(0, 5);
}

export default function ProductPageClient({ product, relatedProducts }: Props) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fitAdvisorOpen, setFitAdvisorOpen] = useState(false);
  const [recommendedSize, setRecommendedSize] = useState<string | null>(null);
  const { recordView } = useRecentlyViewed();
  const addItem = useCartStore((s) => s.addItem);

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
    if (!selectedVariant) return;
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      title: product.title,
      image: product.images[0],
      price: product.price,
      size: selectedVariant.size,
      color: selectedVariant.color,
      colorHex: selectedVariant.colorHex,
      quantity,
      shopifyVariantId: isShopifyVariantGid(selectedVariant.shopifyVariantId ?? selectedVariant.id)
        ? selectedVariant.shopifyVariantId ?? selectedVariant.id
        : undefined,
    });
    track.addedToCart(product, selectedVariant, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  const discountPct = product.compareAtPrice
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : null;
  const categoryLabel = product.category.charAt(0).toUpperCase() + product.category.slice(1);
  const details = productDetailBullets(product.description);

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
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">
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
                <span className="text-xs text-ivory-dim">
                  {product.rating} ({product.reviewCount} {product.reviewCount === 1 ? 'review' : 'reviews'})
                </span>
              </div>
            ) : (
              <p className="mt-3 text-xs text-ivory-dim">No reviews yet</p>
            )}

            <div className="mt-5 flex items-baseline gap-3">
              <span className="font-serif text-3xl font-light text-gold-400">${product.price.toFixed(2)}</span>
              {product.compareAtPrice && (
                <span className="text-lg text-ivory-dim line-through">${product.compareAtPrice.toFixed(2)}</span>
              )}
              {discountPct && (
                <span className="border border-crimson-400/50 px-2 py-0.5 text-xs uppercase tracking-widest text-crimson-400">
                  {discountPct}% off
                </span>
              )}
            </div>
          </div>

          <div className="h-px bg-gold-600/20" />

          <section className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-ivory">About this item</h2>
              <p className="mt-3 text-[15px] font-light leading-7 text-ivory-muted">{product.description}</p>
              {details.length > 1 && (
                <ul className="mt-4 space-y-3">
                  {details.map((detail) => (
                    <li key={detail} className="flex gap-3 text-[15px] leading-7 text-ivory-muted">
                      <span className="mt-3 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gold-400" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid gap-3 border-y border-gold-600/15 py-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-ivory-muted">Material</p>
                <p className="mt-1 text-sm leading-6 text-ivory-muted">{product.material}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-ivory-muted">Care</p>
                <p className="mt-1 text-sm leading-6 text-ivory-muted">{product.careInstructions}</p>
              </div>
            </div>
          </section>

          <VariantSelector
            key={`${product.id}:${recommendedSize ?? 'none'}`}
            product={product}
            onVariantChange={setSelectedVariant}
            preferredSize={recommendedSize}
          />
          <FitConfidenceBadge product={product} variant="pdp" onOpenFitAdvisor={() => setFitAdvisorOpen(true)} />

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-ivory-muted">Quantity</p>
            <div className="flex w-fit items-center gap-4 border border-wine-700 px-5 py-2.5">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="text-ivory-muted hover:text-gold-400 transition">-</button>
              <span className="w-5 text-center text-sm text-ivory">{quantity}</span>
              <button onClick={() => setQuantity((q) => q + 1)} className="text-ivory-muted hover:text-gold-400 transition">+</button>
            </div>
          </div>

          <button
            onClick={() => setFitAdvisorOpen(true)}
            className="flex w-full items-center justify-center gap-2 border border-dashed border-gold-600/40 py-3 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-400 hover:text-gold-400"
          >
            <Sparkles size={13} />
            Not sure of your size? Try our Fit Advisor
          </button>

          <button
            onClick={handleAddToCart}
            disabled={!selectedVariant}
            className={`flex items-center justify-center gap-2.5 py-4 text-xs font-medium uppercase tracking-[0.2em] transition ${
              added
                ? 'border border-green-600/50 bg-green-900/30 text-green-400'
                : selectedVariant
                ? 'border border-gold-400 text-gold-400 hover:bg-gold-400 hover:text-wine-950'
                : 'cursor-not-allowed border border-wine-700 text-wine-600'
            }`}
          >
            <ShoppingBag size={15} />
            {added ? 'Added to Bag' : selectedVariant ? 'Add to Bag' : 'Select Size & Color'}
          </button>
        </div>
      </div>

      <RelatedProducts product={product} products={relatedProducts} />
      <ReviewSection productId={product.id} productHandle={product.handle} seedRating={product.rating} seedCount={product.reviewCount} />
      <RecentlyViewedSection excludeId={product.id} />

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gold-600/20 bg-wine-950/95 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-ivory">{product.title}</p>
            <p className="font-serif text-base text-gold-400">${product.price.toFixed(2)}</p>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={!selectedVariant}
            className={`flex flex-shrink-0 items-center gap-2 px-5 py-3 text-xs font-medium uppercase tracking-widest transition ${
              added
                ? 'border border-green-600/50 bg-green-900/30 text-green-400'
                : selectedVariant
                ? 'bg-gold-400 text-wine-950'
                : 'bg-wine-700 text-wine-500'
            }`}
          >
            <ShoppingBag size={14} />
            {added ? 'Added' : selectedVariant ? 'Add to Bag' : 'Select Size'}
          </button>
        </div>
      </div>

      <FitAdvisor
        open={fitAdvisorOpen}
        onClose={() => setFitAdvisorOpen(false)}
        product={product}
        onSelectSize={(size) => {
          setRecommendedSize(size);
          setSelectedVariant(null);
        }}
      />
    </div>
  );
}
