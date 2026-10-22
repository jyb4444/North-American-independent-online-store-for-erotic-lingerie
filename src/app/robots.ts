import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV === 'preview') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private, per-customer pages and APIs (these pages also send noindex).
      disallow: ['/account', '/admin', '/orders', '/returns', '/track', '/login', '/api/', '/auth/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
