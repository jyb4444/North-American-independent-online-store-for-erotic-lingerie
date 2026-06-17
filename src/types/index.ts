export type ProductVariant = {
  id: string;
  size: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'Free Size';
  color: string;
  colorHex: string;
  stock: number;
  sku: string;
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
  material: string;
  careInstructions: string;
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
  title: string;
  image: string;
  price: number;
  size: string;
  color: string;
  colorHex: string;
  quantity: number;
};

export type MembershipTier = 'none' | 'bronze' | 'silver' | 'gold';

export type CustomerProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  membershipTier: MembershipTier;
  points: number;
  totalSpent: number;
};
