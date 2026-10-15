import type { MetadataRoute } from 'next';
import { getAllCollections, getAllProducts } from '@/lib/products';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const STATIC_PATHS = [
  '/',
  '/sale',
  '/membership',
  '/pages/about',
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, collections] = await Promise.all([getAllProducts(), getAllCollections()]);
  return [
    ...STATIC_PATHS.map((path) => ({ url: `${SITE_URL}${path}` })),
    ...collections.map((collection) => ({ url: `${SITE_URL}/collections/${collection.handle}` })),
    ...products.map((product) => ({ url: `${SITE_URL}/products/${product.handle}` })),
  ];
}
