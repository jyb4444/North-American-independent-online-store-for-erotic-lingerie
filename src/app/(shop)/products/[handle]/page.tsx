import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ProductPageClient from './ProductPageClient';
import { getAllProducts, getProductByHandle, getReviewStats } from '@/lib/products';
import JsonLd from '@/components/seo/JsonLd';
import { absoluteUrl, conciseDescription, publicPageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ handle: string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product) return { title: 'Product Not Found', robots: { index: false, follow: false } };

  const title = product.seoTitle || product.title;
  const description = conciseDescription(product.seoDescription || product.description);
  return publicPageMetadata({
    title,
    description,
    path: `/products/${product.handle}`,
    image: product.images[0],
  });
}

export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  const found = await getProductByHandle(handle);

  if (!found) notFound();
  const product = { ...found, ...(await getReviewStats(found.id)) };

  const relatedProducts = (await getAllProducts())
    .filter((item) => item.id !== product.id)
    .map((item) => {
      let score = 0;
      if (item.category === product.category) score += 3;
      score += item.tags.filter((tag) => product.tags.includes(tag)).length;
      return { product: item, score };
    })
    .sort((a, b) => b.score - a.score || b.product.rating - a.product.rating)
    .slice(0, 4)
    .map((item) => item.product);

  const productUrl = absoluteUrl(`/products/${product.handle}`);
  const variantOffers = product.variants
    .filter((variant) => typeof variant.price === 'number' && variant.price >= 0)
    .map((variant) => ({
      '@type': 'Offer',
      name: `${product.title} — ${variant.color}, ${variant.size}`,
      url: productUrl,
      priceCurrency: variant.currency || product.currency || 'USD',
      price: variant.price!.toFixed(2),
      availability: variant.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': `${absoluteUrl('/')}#organization` },
      ...(variant.sourceSku ? { sku: variant.sourceSku } : {}),
    }));
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    name: product.title,
    description: conciseDescription(product.seoDescription || product.description, product.description, 5000),
    url: productUrl,
    image: product.images,
    brand: { '@type': 'Brand', name: product.vendor || 'Self Love' },
    offers: variantOffers.length > 0 ? variantOffers : {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: product.currency || 'USD',
      price: product.price.toFixed(2),
      availability: product.variants.some((variant) => variant.stock > 0)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@id': `${absoluteUrl('/')}#organization` },
    },
    ...(product.reviewCount > 0 && product.rating > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating,
        reviewCount: product.reviewCount,
        bestRating: 5,
        worstRating: 1,
      },
    } : {}),
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Shop All', item: absoluteUrl('/collections/all') },
      { '@type': 'ListItem', position: 3, name: product.title, item: productUrl },
    ],
  };

  return (
    <>
      <JsonLd data={productSchema} />
      <JsonLd data={breadcrumbSchema} />
      <ProductPageClient product={product} relatedProducts={relatedProducts} />
    </>
  );
}
