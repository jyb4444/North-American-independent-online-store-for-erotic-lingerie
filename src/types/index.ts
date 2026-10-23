export type ProductVariant = {
  id: string;
  /** Shopify's exact customer-facing size label. Never silently coerce an unknown label. */
  size: string;
  color: string;
  colorHex: string;
  stock: number;
  sku: string;
  sourceSku?: string;
  price?: number;
  currency?: string;
  shopifyVariantId?: string;
};
export type ModelMeasurements = {
  height: string;
  size: string;
  bust?: string;
};

export type Product = {
  id: string;
  handle: string;
  title: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  video?: string;
  modelMeasurements?: ModelMeasurements;
  category: string;
  tags: string[];
  variants: ProductVariant[];
  rating: number;
  reviewCount: number;
  isNew: boolean;
  isBestseller: boolean;
  material?: string;
  careInstructions: string;
  vendor?: string;
  currency?: string;
  updatedAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  imageAltTexts?: (string | null)[];
  /** Gift cards use their dedicated purchase flow and never appear in apparel listings. */
  isGiftCard?: boolean;
};

export type Collection = {
  id: string;
  handle: string;
  title: string;
  description?: string;
  image?: string;
  productCount: number;
};

export type CartItem = {
  variantId: string;
  productId: string;
  /** Stable storefront URL identity. Optional only for carts saved by older releases. */
  productHandle?: string;
  title: string;
  image: string;
  price: number;
  size: string;
  color: string;
  colorHex: string;
  quantity: number;
  currency?: string;
  stock?: number;
  // Shopify Global ID — set after products are synced to Shopify
  // Format: gid://shopify/ProductVariant/XXXXX
  shopifyVariantId?: string;
};
