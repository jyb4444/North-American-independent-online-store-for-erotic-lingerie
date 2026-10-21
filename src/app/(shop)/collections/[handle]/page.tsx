import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import CollectionPageClient from './CollectionPageClient';
import { getCollectionByHandle, getProductsByCollection } from '@/lib/products';
import JsonLd from '@/components/seo/JsonLd';
import { absoluteUrl, conciseDescription, publicPageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ handle: string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const collection = await getCollectionByHandle(handle);
  if (!collection) return { title: 'Collection Not Found', robots: { index: false, follow: false } };

  const description = conciseDescription(
    collection.description,
    `Shop ${collection.title.toLowerCase()} from the Self Love intimate apparel collection.`,
  );
  return publicPageMetadata({
    title: collection.title,
    description,
    path: `/collections/${collection.handle}`,
    image: collection.image?.includes('placehold.co') ? undefined : collection.image,
  });
}

export default async function CollectionPage({ params }: Props) {
  const { handle } = await params;
  const collection = await getCollectionByHandle(handle);

  if (!collection) notFound();

  const baseProducts = await getProductsByCollection(handle);

  const collectionUrl = absoluteUrl(`/collections/${collection.handle}`);
  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: collection.title, item: collectionUrl },
        ],
      }} />
      {baseProducts.length > 0 && <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: collection.title,
        numberOfItems: baseProducts.length,
        itemListElement: baseProducts.map((product, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: absoluteUrl(`/products/${product.handle}`),
          name: product.title,
          ...(product.images[0] ? { image: product.images[0] } : {}),
        })),
      }} />}
      <CollectionPageClient
        handle={handle}
        collection={{ ...collection, productCount: baseProducts.length }}
        baseProducts={baseProducts}
      />
    </>
  );
}
