import type { Collection } from '@/types';

export const MOCK_COLLECTIONS: Collection[] = [
  {
    id: 'col_000',
    handle: 'all',
    title: 'Shop ALL',
    description: 'Browse the full private edit.',
    image: 'https://placehold.co/800x400/12080d/white?text=Shop+All',
    productCount: 10,
  },
  {
    id: 'col_001',
    handle: 'new-arrivals',
    title: 'New In',
    description: 'Fresh styles ready for private fit guidance and saved looks.',
    image: 'https://placehold.co/800x400/1a1a1a/white?text=New+Arrivals',
    productCount: 12,
  },
  {
    id: 'col_002',
    handle: 'bestsellers',
    title: 'Fit-Guided Favorites',
    description: 'Boutique pieces selected for comfort, confidence, and private discovery.',
    image: 'https://placehold.co/800x400/2d1b2e/white?text=Bestsellers',
    productCount: 20,
  },
  {
    id: 'col_003',
    handle: 'babydoll',
    title: 'Babydoll',
    description: 'Soft, flowing silhouettes with fit notes to guide your choice.',
    image: 'https://placehold.co/800x400/1c1212/white?text=Babydoll',
    productCount: 15,
  },
  {
    id: 'col_004',
    handle: 'bodysuits',
    title: 'Bodysuits',
    description: 'Sleek one-piece designs with confidence-focused style guidance.',
    image: 'https://placehold.co/800x400/0f0f0f/white?text=Bodysuits',
    productCount: 18,
  },
  {
    id: 'col_005',
    handle: 'sets',
    title: 'Matching Sets',
    description: 'Coordinated pieces to compare, save, and preview privately.',
    image: 'https://placehold.co/800x400/111111/white?text=Sets',
    productCount: 14,
  },
  {
    id: 'col_006',
    handle: 'robes',
    title: 'Robes & Chemises',
    description: 'Luxurious layers for quiet comfort and private styling.',
    image: 'https://placehold.co/800x400/1a1535/white?text=Robes',
    productCount: 10,
  },
  {
    id: 'col_007',
    handle: 'plus-size',
    title: 'Plus Size',
    description: 'Beautiful styles in XL and XXL.',
    image: 'https://placehold.co/800x400/1a0a0a/white?text=Plus+Size',
    productCount: 12,
  },
  {
    id: 'col_008',
    handle: 'discount',
    title: 'Discount',
    description: 'Current markdowns from the private edit.',
    image: 'https://placehold.co/800x400/2d1018/white?text=Discount',
    productCount: 4,
  },
  {
    id: 'col_009',
    handle: 'first-free',
    title: 'First Free',
    description: 'New members can reserve their first eligible style and pay shipping only.',
    image: 'https://placehold.co/800x400/24151f/white?text=First+Free',
    productCount: 4,
  },
];

export function getCollectionByHandle(handle: string): Collection | undefined {
  return MOCK_COLLECTIONS.find((c) => c.handle === handle);
}
