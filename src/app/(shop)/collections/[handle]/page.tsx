import { notFound } from 'next/navigation';
import CollectionPageClient from './CollectionPageClient';
import { getCollectionByHandle, getProductsByCollection } from '@/lib/products';

type Props = { params: Promise<{ handle: string }> };

export const dynamic = 'force-dynamic';

export default async function CollectionPage({ params }: Props) {
  const { handle } = await params;
  const collection = await getCollectionByHandle(handle);

  if (!collection) notFound();

  const baseProducts = await getProductsByCollection(handle);

  return (
    <CollectionPageClient
      handle={handle}
      collection={{ ...collection, productCount: baseProducts.length }}
      baseProducts={baseProducts}
    />
  );
}
