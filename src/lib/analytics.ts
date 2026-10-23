import posthog from 'posthog-js';
import type { Product, ProductVariant, CartItem } from '@/types';

function priceBucket(price: number) {
  if (!Number.isFinite(price)) return 'unknown';
  if (price < 25) return '<25';
  if (price < 50) return '25-49';
  if (price < 75) return '50-74';
  if (price < 100) return '75-99';
  return '100+';
}

function textLengthBucket(text: string) {
  const length = text.trim().length;
  if (length === 0) return '0';
  if (length <= 10) return '1-10';
  if (length <= 30) return '11-30';
  return '31+';
}

const SENSITIVE_ANALYTICS_KEYS = new Set(['product_id', 'product_handle', 'variant_id', 'size', 'color', 'items', 'total', 'price', 'recommended_size']);

function safePagePath(path: string) {
  const pathname = path.split(/[?#]/, 1)[0] || '/';
  if (pathname.startsWith('/products/')) return '/products/:product';
  if (pathname.startsWith('/collections/')) return '/collections/:collection';
  if (/^\/orders\/[^/]+/.test(pathname)) return '/orders/:order';
  if (/^\/returns\/[^/]+/.test(pathname)) return '/returns/:request';
  if (/^\/track\/[^/]+/.test(pathname)) return '/track/:token';
  return pathname;
}

function capture(event: string, properties?: Record<string, unknown>) {
  const safeProperties = properties
    ? Object.fromEntries(Object.entries(properties).filter(([key]) => !SENSITIVE_ANALYTICS_KEYS.has(key)))
    : undefined;
  posthog.capture(event, safeProperties);
}

export function disableAnalytics() {
  if (typeof window === 'undefined') return;
  posthog.opt_out_capturing();
  posthog.reset();
}

export function enableAnalytics() {
  if (typeof window === 'undefined') return;
  posthog.opt_in_capturing();
}

export function initAnalytics() {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
    capture_pageview: false, // handled manually via Next.js router
    persistence: 'localStorage',
  });
}

export const track = {
  pageView: (path: string) => {
    capture('$pageview', { path: safePagePath(path) });
  },

  productViewed: (product: Product) => {
    capture('product_viewed', {
      product_id: product.id,
      product_handle: product.handle,
      category: product.category,
      price_bucket: priceBucket(product.price),
      is_new: product.isNew,
    });
  },

  productImageViewed: (productId: string, imageIndex: number) => {
    capture('product_image_viewed', { product_id: productId, image_index: imageIndex });
  },

  variantSelected: (productId: string, variant: ProductVariant) => {
    capture('variant_selected', {
      product_id: productId,
      variant_id: variant.id,
      size: variant.size,
      color: variant.color,
    });
  },

  addedToCart: (product: Product, variant: ProductVariant, quantity: number) => {
    capture('added_to_cart', {
      product_id: product.id,
      product_handle: product.handle,
      variant_id: variant.id,
      size: variant.size,
      color: variant.color,
      price_bucket: priceBucket(product.price),
      quantity,
    });
  },

  removedFromCart: (item: CartItem) => {
    capture('removed_from_cart', {
      product_id: item.productId,
      variant_id: item.variantId,
      price: item.price,
    });
  },

  cartViewed: (items: CartItem[], total: number) => {
    capture('cart_viewed', {
      item_count: items.length,
      total,
      items: items.map((i) => ({ product_id: i.productId, variant_id: i.variantId })),
    });
  },

  checkoutStarted: (items: CartItem[], total: number) => {
    capture('checkout_started', { item_count: items.length, total });
  },

  cartSaveForLaterClicked: (payload: { product_id: string; product_handle: string; source: 'cart_drawer' }) => {
    capture('cart_save_for_later_clicked', payload);
  },

  cartItemMovedToWishlist: (payload: { product_id: string; product_handle: string; source: 'cart_drawer' }) => {
    capture('cart_item_moved_to_wishlist', payload);
  },

  cartSaveForLaterFailed: (payload: { product_id: string; product_handle: string; source: 'cart_drawer' }) => {
    capture('cart_save_for_later_failed', payload);
  },

  cartRecommendationsViewed: (payload: {
    product_id: string;
    product_handle: string;
    source: 'cart_drawer';
    recommendation_type: 'soft_match' | 'featured' | 'category_match';
  }) => {
    capture('cart_recommendations_viewed', payload);
  },

  cartRecommendationClicked: (payload: {
    product_id: string;
    product_handle: string;
    source: 'cart_drawer';
    recommendation_type: 'soft_match' | 'featured' | 'category_match';
  }) => {
    capture('cart_recommendation_clicked', payload);
  },

  cartRecommendationAdded: (payload: {
    product_id: string;
    product_handle: string;
    source: 'cart_drawer';
    recommendation_type: 'soft_match' | 'featured' | 'category_match';
  }) => {
    capture('cart_recommendation_added', payload);
  },

  cartPrivacyReminderViewed: (payload: { cart_item_count: number; source: 'cart_drawer' }) => {
    capture('cart_privacy_reminder_viewed', payload);
  },

  emptyCartGuidanceViewed: (payload: { saved_count: number; is_authenticated: boolean }) => {
    capture('empty_cart_guidance_viewed', payload);
  },

  emptyCartGuidanceClicked: (payload: {
    action: 'continue_shopping' | 'view_saved_styles';
    saved_count: number;
    is_authenticated: boolean;
  }) => {
    capture('empty_cart_guidance_clicked', payload);
  },

  searchPerformed: (query: string, resultCount: number) => {
    capture('search_performed', {
      has_query: query.trim().length > 0,
      query_length_bucket: textLengthBucket(query),
      result_count: resultCount,
    });
  },

  collectionViewed: (handle: string) => {
    capture('collection_viewed', { collection_handle: handle });
  },

  memberRegistered: (tier: string) => {
    capture('member_registered', { tier });
  },

  fitProfileSaved: (payload: { source: string; has_profile: boolean; profile_fields_count: number }) => {
    capture('fit_profile_saved', payload);
  },

  fitProfileUpdated: (payload: { source: string; has_profile: boolean; profile_fields_count: number }) => {
    capture('fit_profile_updated', payload);
  },

  fitProfileCleared: (payload: { source: string; has_profile: boolean; profile_fields_count: number }) => {
    capture('fit_profile_cleared', payload);
  },

  privacyTrustBadgeViewed: (payload: { context: string; item_count: number }) => {
    capture('privacy_trust_badge_viewed', payload);
  },

  wishlistAdded: (payload: { product_id: string; product_handle: string; source: string }) => {
    capture('wishlist_added', payload);
  },

  wishlistRemoved: (payload: { product_id: string; product_handle: string; source: string }) => {
    capture('wishlist_removed', payload);
  },

  wishlistReminderViewed: (payload: { saved_count: number; source: string; is_authenticated: boolean }) => {
    capture('wishlist_reminder_viewed', payload);
  },

  wishlistReminderClicked: (payload: { saved_count: number; source: string; is_authenticated: boolean }) => {
    capture('wishlist_reminder_clicked', payload);
  },

  wishlistCountViewed: (payload: { saved_count: number; source: string; is_authenticated: boolean }) => {
    capture('wishlist_count_viewed', payload);
  },

  aiPreviewTried: (payload: { product_id: string; product_handle: string; source: string }) => {
    capture('ai_preview_tried', payload);
  },

  aiPreviewSavePromptViewed: (payload: {
    product_id: string;
    product_handle: string;
    has_recommended_size: boolean;
    source: string;
    saved_count: number;
  }) => {
    capture('ai_preview_save_prompt_viewed', payload);
  },

  aiLookSaved: (payload: {
    product_id: string | null;
    product_handle: string | null;
    has_recommended_size: boolean;
    source: string;
    saved_count: number;
  }) => {
    capture('ai_look_saved', payload);
  },

  aiLookDeleted: (payload: { source: string; saved_count: number }) => {
    capture('ai_look_deleted', payload);
  },

  aiLookbookViewed: (payload: { source: string; saved_count: number }) => {
    capture('ai_lookbook_viewed', payload);
  },

  dailyRewardViewed: (payload: {
    reward_type: string;
    source: 'home' | 'account' | 'membership';
    has_fit_profile: boolean;
    wishlist_count_bucket: '0' | '1-3' | '4+';
    ai_look_count_bucket: '0' | '1-3' | '4+';
    is_authenticated: boolean;
  }) => {
    capture('daily_reward_viewed', payload);
  },

  dailyRewardRevealed: (payload: {
    reward_type: string;
    source: 'home' | 'account' | 'membership';
    has_fit_profile: boolean;
    wishlist_count_bucket: '0' | '1-3' | '4+';
    ai_look_count_bucket: '0' | '1-3' | '4+';
    is_authenticated: boolean;
  }) => {
    capture('daily_reward_revealed', payload);
  },

  dailyRewardDismissed: (payload: {
    reward_type: string;
    source: 'home' | 'account' | 'membership';
    has_fit_profile: boolean;
    wishlist_count_bucket: '0' | '1-3' | '4+';
    ai_look_count_bucket: '0' | '1-3' | '4+';
    is_authenticated: boolean;
  }) => {
    capture('daily_reward_dismissed', payload);
  },

  dailyRewardCtaClicked: (payload: {
    reward_type: string;
    source: 'home' | 'account' | 'membership';
    has_fit_profile: boolean;
    wishlist_count_bucket: '0' | '1-3' | '4+';
    ai_look_count_bucket: '0' | '1-3' | '4+';
    is_authenticated: boolean;
  }) => {
    capture('daily_reward_cta_clicked', payload);
  },

  softCountdownViewed: (payload: {
    promo_id: string;
    source: 'home' | 'product_card' | 'pdp';
    product_id?: string;
    product_handle?: string;
    time_remaining_bucket: 'expired' | '<1h' | '1-6h' | '6-24h' | '1d+';
    cta_type: string;
    is_authenticated: boolean;
  }) => {
    capture('soft_countdown_viewed', payload);
  },

  softCountdownClicked: (payload: {
    promo_id: string;
    source: 'home' | 'product_card' | 'pdp';
    product_id?: string;
    product_handle?: string;
    time_remaining_bucket: 'expired' | '<1h' | '1-6h' | '6-24h' | '1d+';
    cta_type: string;
    is_authenticated: boolean;
  }) => {
    capture('soft_countdown_clicked', payload);
  },

  styleEditViewed: (payload: {
    promo_id: string;
    source: 'home' | 'product_card' | 'pdp';
    product_id?: string;
    product_handle?: string;
    time_remaining_bucket: 'expired' | '<1h' | '1-6h' | '6-24h' | '1d+';
    cta_type: string;
    is_authenticated: boolean;
  }) => {
    capture('style_edit_viewed', payload);
  },

  styleEditCtaClicked: (payload: {
    promo_id: string;
    source: 'home' | 'product_card' | 'pdp';
    product_id?: string;
    product_handle?: string;
    time_remaining_bucket: 'expired' | '<1h' | '1-6h' | '6-24h' | '1d+';
    cta_type: string;
    is_authenticated: boolean;
  }) => {
    capture('style_edit_cta_clicked', payload);
  },

  onboardingTaskViewed: (payload: {
    task_id: string;
    completed_count: number;
    total_count: number;
    source: string;
  }) => {
    capture('onboarding_task_viewed', payload);
  },

  onboardingTaskCompleted: (payload: {
    task_id: string;
    completed_count: number;
    total_count: number;
    source: string;
  }) => {
    capture('onboarding_task_completed', payload);
  },

  onboardingChecklistDismissed: (payload: { completed_count: number; total_count: number; source: string }) => {
    capture('onboarding_checklist_dismissed', payload);
  },

  onboardingChecklistCompleted: (payload: { completed_count: number; total_count: number; source: string }) => {
    capture('onboarding_checklist_completed', payload);
  },

  ageGatePassed: () => {
    capture('age_gate_passed');
  },

  ageGateDenied: () => {
    capture('age_gate_denied');
  },

  identify: (userId: string) => {
    // Account identifiers are intentionally not sent to analytics.
    void userId;
  },

  reset: () => {
    disableAnalytics();
  },
};
