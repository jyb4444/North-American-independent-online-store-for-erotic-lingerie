import type { MetadataRoute } from 'next';
import { getAllCollections, getAllProducts } from '@/lib/products';
import { absoluteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const STATIC_PATHS = [
  '/',
  '/sale',
  '/pages/contact',
  '/pages/faq',
  '/pages/gift-card',
  '/pages/privacy',
  '/pages/referral',
  '/pages/returns',
  '/pages/shipping',
  '/pages/size-guide',
  '/pages/terms',
];

function validLastModified(value: string | undefined) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, collections] = await Promise.all([getAllProducts(), getAllCollections()]);
  const entries: MetadataRoute.Sitemap = [
    ...STATIC_PATHS.map((path) => ({
      url: absoluteUrl(path),
      changeFrequency: path === '/' ? 'daily' as const : 'monthly' as const,
      priority: path === '/' ? 1 : 0.5,
    })),
    ...collections.map((collection) => ({
      url: absoluteUrl(`/collections/${collection.handle}`),
      changeFrequency: 'weekly' as const,
      priority: collection.handle === 'all' ? 0.9 : 0.7,
    })),
    ...products.map((product) => ({
      url: absoluteUrl(`/products/${product.handle}`),
      lastModified: validLastModified(product.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      images: product.images.filter((image) => /^https?:\/\//i.test(image)),
    })),
  ];

  return entries.filter((entry, index) => entries.findIndex((candidate) => candidate.url === entry.url) === index);
}
