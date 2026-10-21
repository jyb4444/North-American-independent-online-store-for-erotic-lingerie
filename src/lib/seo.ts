import type { Metadata } from 'next';

const FALLBACK_SITE_URL = 'http://localhost:3100';

function productionSiteUrlError(value: string | undefined) {
  if (process.env.VERCEL_ENV !== 'production') return;
  if (!value) return 'NEXT_PUBLIC_SITE_URL is required for a production deployment.';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname)) {
      return 'NEXT_PUBLIC_SITE_URL must be the public HTTPS storefront URL in production.';
    }
  } catch {
    return 'NEXT_PUBLIC_SITE_URL must be a valid absolute URL in production.';
  }
}

const siteUrlError = productionSiteUrlError(process.env.NEXT_PUBLIC_SITE_URL);
if (siteUrlError) throw new Error(siteUrlError);

function normalizedSiteUrl(value: string | undefined) {
  try {
    const url = new URL(value || FALLBACK_SITE_URL);
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export const SITE_NAME = 'Self Love';
export const SITE_URL = normalizedSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const DEFAULT_DESCRIPTION = 'Discover intimate apparel, lingerie and hosiery with discreet shopping, thoughtful sizing guidance and curated styles.';

export function absoluteUrl(path = '/') {
  return new URL(path, `${SITE_URL}/`).toString();
}

export function conciseDescription(value: string | undefined, fallback = DEFAULT_DESCRIPTION, maxLength = 160) {
  const text = value
    ?.replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim() || fallback;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).replace(/\s+\S*$/, '')}…`;
}

export function publicPageMetadata({
  title,
  description,
  path,
  image,
  type = 'website',
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: 'website' | 'article';
}): Metadata {
  const canonical = absoluteUrl(path);
  const socialImage = image || absoluteUrl('/opengraph-image');
  const images = [{ url: socialImage, alt: title }];
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type,
      siteName: SITE_NAME,
      title,
      description,
      url: canonical,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [socialImage],
    },
  };
}

export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
