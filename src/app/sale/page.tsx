import Link from 'next/link';
import { Tag } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';
import { getAllProducts } from '@/lib/products';
import { absoluteUrl, publicPageMetadata } from '@/lib/seo';
import JsonLd from '@/components/seo/JsonLd';

export const metadata = publicPageMetadata({
  title: 'Lingerie & Hosiery Sale',
  description: 'Explore current sale pricing on selected lingerie, intimate apparel and hosiery styles from Self Love.',
  path: '/sale',
});

export const dynamic = 'force-dynamic';

export default async function SalePage() {
  const products = await getAllProducts();
  const saleProducts = products.filter((product) =>
    typeof product.compareAtPrice === 'number' && product.compareAtPrice > product.price
  );

  if (saleProducts.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <Tag size={32} className="mb-4 text-gold-400/40" />
        <h1 className="font-serif text-3xl font-light text-ivory">No Active Sale</h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-ivory-muted">
          Sale styles will appear here after products have a compare-at price higher than their current price.
        </p>
        <Link
          href="/collections/all"
          className="mt-6 border border-gold-400 px-6 py-3 text-xs font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
        >
          Shop ALL
        </Link>
      </div>
    );
  }

  return (
    <>
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Self Love sale styles',
        numberOfItems: saleProducts.length,
        itemListElement: saleProducts.map((product, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: product.title,
          url: absoluteUrl(`/products/${product.handle}`),
          ...(product.images[0] ? { image: product.images[0] } : {}),
        })),
      }} />
      <div>
        <div className="relative overflow-hidden border-b border-gold-600/20 bg-wine-900 px-4 py-16 text-center sm:py-24">
          <div className="pointer-events-none absolute inset-0 opacity-5" style={{ background: 'radial-gradient(ellipse at center, #c9a84c 0%, transparent 70%)' }} />
          <p className="mb-4 inline-block border border-crimson-400/50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.3em] text-crimson-400">
            Current Markdowns
          </p>
          <h1 className="font-serif text-5xl font-light text-ivory sm:text-6xl">SALES</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ivory-muted">
            Styles with active sale pricing from Shopify.
          </p>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <div className="mb-8">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-gold-400">
              Compare-at price active
            </p>
            <h2 className="font-serif text-2xl font-light text-ivory">
              {saleProducts.length} sale style{saleProducts.length === 1 ? '' : 's'}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {saleProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
