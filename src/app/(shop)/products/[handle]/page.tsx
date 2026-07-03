import { notFound } from 'next/navigation';
import ProductPageClient from './ProductPageClient';
import { getAllProducts, getProductByHandle } from '@/lib/products';

type Props = { params: Promise<{ handle: string }> };

export const dynamic = 'force-dynamic';

export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);

  if (!product) notFound();

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

  return <ProductPageClient product={product} relatedProducts={relatedProducts} />;
}
