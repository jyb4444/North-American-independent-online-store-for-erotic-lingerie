'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Gift, Heart, Ruler, ShoppingBag, Sparkles, Trash2, X, Check } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCartStore } from '@/store/cart';
import { track } from '@/lib/analytics';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import FitConfidenceBadge from '@/components/product/FitConfidenceBadge';
import PrivacyTrustBar from '@/components/ui/PrivacyTrustBar';
import { MOCK_PRODUCTS } from '@/mock/products';
import { createClient } from '@/lib/supabase/client';
import { notifyWishlistChanged, useWishlistSummary } from '@/hooks/useWishlistSummary';
import { useFitProfile } from '@/hooks/useFitProfile';
import type { CartItem, Product } from '@/types';

type RecommendationType = 'soft_match' | 'featured' | 'category_match';
type CartRecommendation = {
  product: Product;
  type: RecommendationType;
};

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, totalPrice, effectiveTotal, giftCard, applyGiftCard, removeGiftCard } = useCartStore();
  const addItem = useCartStore((s) => s.addItem);
  const { hasProfile, getFitResult } = useFitProfile();
  const wishlistSummary = useWishlistSummary(3);
  const router = useRouter();
  const [movingVariantId, setMovingVariantId] = useState<string | null>(null);
  const [moveErrorVariantId, setMoveErrorVariantId] = useState<string | null>(null);

  // Gift card state
  const [gcInput, setGcInput] = useState('');
  const [gcState, setGcState] = useState<'idle' | 'checking' | 'error'>('idle');
  const [gcError, setGcError] = useState('');

  async function handleApplyGiftCard() {
    const code = gcInput.trim().toUpperCase();
    if (!code) return;
    setGcState('checking');
    setGcError('');
    try {
      const res = await fetch(`/api/gift-card?code=${encodeURIComponent(code)}`);
      const data = await res.json() as { balance?: number; error?: string };
      if (!res.ok || !data.balance) throw new Error(data.error ?? 'Invalid code');
      applyGiftCard(code, data.balance);
      setGcInput('');
      setGcState('idle');
    } catch (err) {
      setGcError(err instanceof Error ? err.message : 'Invalid gift card code.');
      setGcState('error');
    }
  }
  const hasCheckoutDomain = !!process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN
    && process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN !== 'your-store.myshopify.com';

  const cartProducts = useMemo(
    () => items
      .map((item) => MOCK_PRODUCTS.find((product) => product.id === item.productId))
      .filter((product): product is Product => !!product),
    [items]
  );

  const recommendations = useMemo<CartRecommendation[]>(() => {
    const cartProductIds = new Set(items.map((item) => item.productId));
    const cartCategories = new Set(cartProducts.map((product) => product.category));
    const cartTags = new Set(cartProducts.flatMap((product) => product.tags));
    const picked = new Map<string, CartRecommendation>();

    function addRecommendation(product: Product, type: RecommendationType) {
      if (!cartProductIds.has(product.id) && !picked.has(product.id)) {
        picked.set(product.id, { product, type });
      }
    }

    MOCK_PRODUCTS
      .filter((product) => cartCategories.has(product.category))
      .forEach((product) => addRecommendation(product, 'category_match'));

    if (picked.size < 3) {
      MOCK_PRODUCTS
        .filter((product) => product.tags.some((tag) => cartTags.has(tag)))
        .forEach((product) => addRecommendation(product, 'soft_match'));
    }

    if (picked.size < 3) {
      MOCK_PRODUCTS
        .filter((product) => product.isBestseller || product.isNew)
        .forEach((product) => addRecommendation(product, 'featured'));
    }

    return Array.from(picked.values()).slice(0, 3);
  }, [cartProducts, items]);

  useEffect(() => {
    if (isOpen && items.length > 0) {
      track.cartViewed(items, totalPrice());
    }
  }, [isOpen, items, totalPrice]);

  const fitSummarySignature = useMemo(() => (
    items.map((item) => {
      const product = MOCK_PRODUCTS.find((p) => p.id === item.productId);
      const result = product ? getFitResult(product) : null;
      return `${item.productId}:${result?.recommendedSize ?? 'none'}`;
    }).join('|')
  ), [getFitResult, items]);

  useEffect(() => {
    if (!isOpen || items.length === 0) return;
    const firstProduct = cartProducts[0];
    const result = firstProduct ? getFitResult(firstProduct) : null;
    track.cartFitSummaryViewed({
      cart_item_count: items.length,
      has_fit_profile: hasProfile,
      product_id: firstProduct?.id,
      product_handle: firstProduct?.handle,
      recommended_size: result?.recommendedSize,
    });
  }, [cartProducts, fitSummarySignature, getFitResult, hasProfile, isOpen, items.length]);

  useEffect(() => {
    if (!isOpen || items.length === 0) return;
    recommendations.forEach(({ product, type }) => {
      track.cartRecommendationsViewed({
        product_id: product.id,
        product_handle: product.handle,
        source: 'cart_drawer',
        recommendation_type: type,
      });
    });
  }, [isOpen, items.length, recommendations]);

  useEffect(() => {
    if (!isOpen || items.length > 0 || wishlistSummary.loading) return;
    track.emptyCartGuidanceViewed({
      has_fit_profile: hasProfile,
      saved_count: wishlistSummary.count,
      is_authenticated: wishlistSummary.isAuthenticated,
    });
  }, [hasProfile, isOpen, items.length, wishlistSummary.count, wishlistSummary.isAuthenticated, wishlistSummary.loading]);

  useEffect(() => {
    if (!isOpen) return;
    track.cartPrivacyReminderViewed({
      cart_item_count: items.length,
      source: 'cart_drawer',
    });
  }, [isOpen, items.length]);

  function handleRemove(variantId: string) {
    const item = items.find((i) => i.variantId === variantId);
    if (item) track.removedFromCart(item);
    removeItem(variantId);
  }

  function findProduct(item: CartItem) {
    return MOCK_PRODUCTS.find((product) => product.id === item.productId);
  }

  function handleFitCtaClick(product?: Product) {
    const result = product ? getFitResult(product) : null;
    track.cartFitCtaClicked({
      cart_item_count: items.length,
      has_fit_profile: hasProfile,
      product_id: product?.id,
      product_handle: product?.handle,
      recommended_size: result?.recommendedSize,
    });
    closeCart();
  }

  async function handleMoveToWishlist(item: CartItem) {
    const product = findProduct(item);
    if (!product || movingVariantId) return;

    track.cartSaveForLaterClicked({
      product_id: product.id,
      product_handle: product.handle,
      source: 'cart_drawer',
    });

    if (!wishlistSummary.isAuthenticated) {
      closeCart();
      router.push('/login');
      return;
    }

    setMoveErrorVariantId(null);
    setMovingVariantId(item.variantId);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        closeCart();
        router.push('/login');
        return;
      }

      const { data: existing, error: lookupError } = await supabase
        .from('wishlists')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (!existing) {
        const { error: insertError } = await supabase.from('wishlists').insert({
          user_id: user.id,
          product_id: product.id,
          product_handle: product.handle,
          product_title: product.title,
          product_image: product.images[0] ?? null,
          product_price: product.price,
        });
        if (insertError) throw insertError;
      }

      notifyWishlistChanged();
      removeItem(item.variantId);
      track.cartItemMovedToWishlist({
        product_id: product.id,
        product_handle: product.handle,
        source: 'cart_drawer',
      });
    } catch {
      setMoveErrorVariantId(item.variantId);
      track.cartSaveForLaterFailed({
        product_id: product.id,
        product_handle: product.handle,
        source: 'cart_drawer',
      });
    } finally {
      setMovingVariantId(null);
    }
  }

  function handleRecommendationClick(recommendation: CartRecommendation) {
    track.cartRecommendationClicked({
      product_id: recommendation.product.id,
      product_handle: recommendation.product.handle,
      source: 'cart_drawer',
      recommendation_type: recommendation.type,
    });
    closeCart();
  }

  function handleRecommendationAdd(recommendation: CartRecommendation) {
    const variant = recommendation.product.variants[0];
    if (!variant) return;

    addItem({
      variantId: variant.id,
      productId: recommendation.product.id,
      title: recommendation.product.title,
      image: recommendation.product.images[0],
      price: recommendation.product.price,
      size: variant.size,
      color: variant.color,
      colorHex: variant.colorHex,
      quantity: 1,
    });
    track.addedToCart(recommendation.product, variant, 1);
    track.cartRecommendationAdded({
      product_id: recommendation.product.id,
      product_handle: recommendation.product.handle,
      source: 'cart_drawer',
      recommendation_type: recommendation.type,
    });
  }

  function handleEmptyGuidanceClick(action: 'continue_shopping' | 'view_saved_styles' | 'try_fit_advisor') {
    track.emptyCartGuidanceClicked({
      action,
      has_fit_profile: hasProfile,
      saved_count: wishlistSummary.count,
      is_authenticated: wishlistSummary.isAuthenticated,
    });
    closeCart();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 z-40 bg-wine-950/70 backdrop-blur-sm"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gold-600/20 bg-wine-900 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gold-600/20 px-6 py-5">
              <div className="flex items-center gap-2.5">
                <ShoppingBag size={16} className="text-gold-400" />
                <span className="font-serif text-lg font-light italic text-ivory">
                  Your Bag
                  {items.length > 0 && (
                    <span className="ml-2 font-sans text-xs font-normal not-italic text-ivory-muted">
                      ({items.length})
                    </span>
                  )}
                </span>
              </div>
              <button onClick={closeCart} className="text-ivory-dim hover:text-gold-400 transition">
                <X size={18} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {items.length === 0 ? (
                <div className="flex min-h-full flex-col justify-center gap-5 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center border border-gold-600/20 bg-wine-950/40">
                    <ShoppingBag size={26} className="text-gold-400/80" />
                  </div>
                  <div>
                    <p className="font-serif text-xl font-light italic text-ivory">
                      Your private bag is empty
                    </p>
                    <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-ivory-dim">
                      Start with fit-guided styles, or save favorites privately while you decide.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Link
                      href="/"
                      onClick={() => handleEmptyGuidanceClick('continue_shopping')}
                      className="flex w-full items-center justify-center gap-2 border border-gold-400 py-3 text-xs font-medium uppercase tracking-[0.2em] text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
                    >
                      Continue shopping
                      <ArrowRight size={13} />
                    </Link>
                    {wishlistSummary.isAuthenticated && wishlistSummary.count > 0 && (
                      <Link
                        href="/account/wishlist"
                        onClick={() => handleEmptyGuidanceClick('view_saved_styles')}
                        className="flex w-full items-center justify-center gap-2 border border-wine-700 py-3 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-400/50 hover:text-gold-400"
                      >
                        <Heart size={13} />
                        View saved styles
                      </Link>
                    )}
                    {!hasProfile && (
                      <Link
                        href="/products/lace-halter-babydoll-set"
                        onClick={() => handleEmptyGuidanceClick('try_fit_advisor')}
                        className="flex w-full items-center justify-center gap-2 border border-dashed border-gold-600/40 py-3 text-xs uppercase tracking-widest text-ivory-muted transition hover:border-gold-400 hover:text-gold-400"
                      >
                        <Sparkles size={13} />
                        Try Fit Advisor
                      </Link>
                    )}
                  </div>
                  <PrivacyTrustBar context="cart" compact />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="border border-gold-600/20 bg-wine-950/35 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <Ruler size={15} className="mt-0.5 flex-shrink-0 text-gold-400" />
                      <div>
                        <p className="text-xs font-medium uppercase tracking-widest text-gold-400">
                          Fit guidance
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-ivory-dim">
                          {hasProfile
                            ? 'Fit guidance is based on your private profile.'
                            : 'Add your private fit profile for size guidance while you compare styles.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-5">
                    {items.map((item) => (
                      (() => {
                        const product = findProduct(item);
                        const fitResult = product ? getFitResult(product) : null;
                        const showSizeNudge = !!fitResult
                          && item.size !== 'Free Size'
                          && item.size !== fitResult.recommendedSize;

                        return (
                          <li key={item.variantId} className="flex gap-4">
                          <div className="relative h-24 w-20 flex-shrink-0 overflow-hidden rounded-sm bg-wine-800">
                            <Image src={item.image} alt={item.title} fill sizes="80px" className="object-cover" />
                          </div>
                          <div className="flex flex-1 flex-col justify-between">
                            <div>
                              <Link
                                href={product ? `/products/${product.handle}` : `/products/${item.productId}`}
                                onClick={closeCart}
                                className="text-sm font-light text-ivory hover:text-gold-400 transition"
                              >
                                {item.title}
                              </Link>
                              <p className="mt-0.5 text-xs text-ivory-dim">
                                {item.color} / {item.size}
                              </p>
                              {product && <FitConfidenceBadge product={product} variant="cart" />}
                              {showSizeNudge && (
                                <p className="mt-1 text-[11px] leading-relaxed text-ivory-dim">
                                  You selected {item.size}. Your profile may prefer {fitResult.recommendedSize} for comfort.
                                </p>
                              )}
                              {!hasProfile && product && (
                                <Link
                                  href={`/products/${product.handle}`}
                                  onClick={() => handleFitCtaClick(product)}
                                  className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-gold-400 transition hover:text-gold-300"
                                >
                                  Add private fit profile
                                  <ArrowRight size={11} />
                                </Link>
                              )}
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              <div className="flex items-center gap-3 border border-wine-700 px-3 py-1">
                                <button
                                  onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                                  className="text-ivory-muted hover:text-gold-400 transition"
                                >
                                  −
                                </button>
                                <span className="w-4 text-center text-sm text-ivory">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                                  className="text-ivory-muted hover:text-gold-400 transition"
                                >
                                  +
                                </button>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm text-gold-400">
                                  ${(item.price * item.quantity).toFixed(2)}
                                </span>
                                <button
                                  onClick={() => handleRemove(item.variantId)}
                                  className="text-wine-600 hover:text-crimson-400 transition"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                            {product && (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => handleMoveToWishlist(item)}
                                  disabled={movingVariantId === item.variantId}
                                  className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-ivory-dim transition hover:text-gold-400 disabled:cursor-wait disabled:text-wine-600"
                                >
                                  <Heart size={11} />
                                  {movingVariantId === item.variantId
                                    ? 'Saving...'
                                    : wishlistSummary.isAuthenticated
                                      ? 'Move to private wishlist'
                                      : 'Sign in to save privately'}
                                </button>
                                {moveErrorVariantId === item.variantId && (
                                  <p className="mt-1 text-[11px] leading-relaxed text-crimson-400">
                                    Could not save this style. It is still in your bag.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </li>
                        );
                      })()
                    ))}
                  </ul>

                  {recommendations.length > 0 && (
                    <div className="border-t border-gold-600/20 pt-5">
                      <p className="text-xs font-medium uppercase tracking-[0.24em] text-gold-400">
                        Private style picks
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-ivory-dim">
                        Explore matching styles while you compare your bag.
                      </p>
                      <div className="mt-4 space-y-3">
                        {recommendations.map((recommendation) => {
                          const { product } = recommendation;
                          const variant = product.variants[0];
                          return (
                            <div key={product.id} className="flex gap-3 border border-wine-800 bg-wine-950/25 p-2.5">
                              <Link
                                href={`/products/${product.handle}`}
                                onClick={() => handleRecommendationClick(recommendation)}
                                className="relative h-20 w-16 flex-shrink-0 overflow-hidden bg-wine-800"
                              >
                                <Image src={product.images[0]} alt={product.title} fill sizes="64px" className="object-cover" />
                              </Link>
                              <div className="min-w-0 flex-1">
                                <Link
                                  href={`/products/${product.handle}`}
                                  onClick={() => handleRecommendationClick(recommendation)}
                                  className="line-clamp-2 text-xs text-ivory transition hover:text-gold-400"
                                >
                                  {product.title}
                                </Link>
                                <p className="mt-1 font-serif text-sm text-gold-400">${product.price.toFixed(2)}</p>
                                <div className="mt-2 flex items-center gap-3">
                                  <Link
                                    href={`/products/${product.handle}`}
                                    onClick={() => handleRecommendationClick(recommendation)}
                                    className="text-[10px] uppercase tracking-widest text-ivory-dim transition hover:text-gold-400"
                                  >
                                    View item
                                  </Link>
                                  {variant && (
                                    <button
                                      type="button"
                                      onClick={() => handleRecommendationAdd(recommendation)}
                                      className="text-[10px] uppercase tracking-widest text-gold-400 transition hover:text-gold-300"
                                    >
                                      Add to bag
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-gold-600/20 px-6 py-6 space-y-4">
                {/* Subtotal row */}
                <div className="flex justify-between">
                  <span className="text-xs uppercase tracking-widest text-ivory-muted">Subtotal</span>
                  <span className="font-serif text-lg font-light text-gold-400">${totalPrice().toFixed(2)}</span>
                </div>

                {/* Gift card applied */}
                {giftCard && (
                  <div className="flex items-center justify-between border border-gold-600/20 bg-wine-950/40 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Check size={12} className="text-green-400" />
                      <span className="text-xs text-ivory-muted">
                        Gift card <span className="font-mono text-ivory">{giftCard.code}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-green-400">−${Math.min(giftCard.balance, totalPrice()).toFixed(2)}</span>
                      <button
                        onClick={removeGiftCard}
                        className="text-wine-600 transition hover:text-crimson-400"
                        title="Remove gift card"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Effective total (only show when gift card is applied) */}
                {giftCard && (
                  <div className="flex justify-between border-t border-gold-600/15 pt-3">
                    <span className="text-xs uppercase tracking-widest text-ivory-muted">Total</span>
                    <span className="font-serif text-lg font-light text-gold-400">${effectiveTotal().toFixed(2)}</span>
                  </div>
                )}

                {/* Gift card input */}
                {!giftCard && (
                  <div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Gift size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-ivory-dim" />
                        <input
                          type="text"
                          value={gcInput}
                          onChange={(e) => { setGcInput(e.target.value.toUpperCase()); setGcError(''); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleApplyGiftCard(); }}
                          placeholder="Gift card code"
                          maxLength={19}
                          className="w-full border border-wine-700 bg-wine-800 py-2 pl-8 pr-3 text-xs font-mono text-ivory placeholder-ivory-dim/50 focus:border-gold-400 focus:outline-none transition"
                        />
                      </div>
                      <button
                        onClick={handleApplyGiftCard}
                        disabled={gcState === 'checking' || !gcInput.trim()}
                        className="flex-shrink-0 border border-gold-400/50 px-3 py-2 text-[10px] font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {gcState === 'checking' ? '…' : 'Apply'}
                      </button>
                    </div>
                    {gcState === 'error' && gcError && (
                      <p className="mt-1.5 text-[11px] text-crimson-400">{gcError}</p>
                    )}
                  </div>
                )}

                <p className="text-xs text-ivory-dim">
                  {hasCheckoutDomain
                    ? 'Review your private bag before continuing.'
                    : 'Keep planning your private look. Your bag stays private in this browser.'}
                </p>
                <p className="text-[11px] text-ivory-dim">
                  Billing appears as <span className="text-ivory">VLR APPAREL</span> — discreet on all statements.
                </p>
                <PrivacyTrustBar context="cart" compact />
                <button
                  onClick={() => {
                    const shopifyDomain = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN;
                    if (shopifyDomain && shopifyDomain !== 'your-store.myshopify.com') {
                      track.checkoutStarted(items, totalPrice());
                      // TODO: replace SHOPIFY_CHECKOUT_URL with real Shopify cart checkout URL
                      // from: await shopifyFetch({ query: CREATE_CART, variables: { lines } })
                      window.location.href = `https://${shopifyDomain}/checkout`;
                    } else {
                      closeCart();
                    }
                  }}
                  className="w-full border border-gold-400 py-3.5 text-xs font-medium uppercase tracking-[0.2em] text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
                >
                  {hasCheckoutDomain ? 'Continue Privately' : 'Keep Planning Privately'}
                </button>
                <button
                  onClick={closeCart}
                  className="w-full py-2 text-xs uppercase tracking-widest text-ivory-dim transition hover:text-ivory-muted"
                >
                  Continue Exploring
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
