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
    handle: 'hosiery',
    title: 'Hosiery',
    description: 'Sheer and statement hosiery selected for the current edit.',
    image: 'https://placehold.co/800x400/1a1a1a/white?text=Hosiery',
    productCount: 4,
  },
];

export function getCollectionByHandle(handle: string): Collection | undefined {
  return MOCK_COLLECTIONS.find((c) => c.handle === handle);
}
