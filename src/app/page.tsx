import Link from 'next/link';
import HeroCarousel from '@/components/ui/HeroCarousel';
import ProductCarousel from '@/components/ui/ProductCarousel';
import ProductCard from '@/components/product/ProductCard';
import RecentlyViewedSection from '@/components/ui/RecentlyViewedSection';
import { getAllProducts, getBestsellers, getNewArrivals } from '@/lib/products';
import JsonLd from '@/components/seo/JsonLd';
import { absoluteUrl, publicPageMetadata } from '@/lib/seo';

export const metadata = publicPageMetadata({
  title: 'Self Love — Intimate Apparel, Lingerie & Hosiery',
  description: 'Shop curated intimate apparel, lingerie and hosiery with discreet shopping and thoughtful size guidance.',
  path: '/',
});

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [newArrivals, bestsellers, allProducts] = await Promise.all([
    getNewArrivals(),
    getBestsellers(),
    getAllProducts(),
  ]);
  const hotProducts = [...bestsellers, ...allProducts]
    .filter((product, index, products) => products.findIndex((p) => p.id === product.id) === index)
    .sort((a, b) => Number(b.isBestseller) - Number(a.isBestseller) || b.rating - a.rating)
    .slice(0, 8);
  const featuredProducts = [...newArrivals, ...hotProducts]
    .filter((product, index, products) => products.findIndex((item) => item.id === product.id) === index);

  return (
    <>
      {featuredProducts.length > 0 && <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Featured Self Love styles',
        numberOfItems: featuredProducts.length,
        itemListElement: featuredProducts.map((product, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: product.title,
          url: absoluteUrl(`/products/${product.handle}`),
          ...(product.images[0] ? { image: product.images[0] } : {}),
        })),
      }} />}
      <div className="space-y-20 pb-24">
        {/* ── Hero Carousel ── */}
        <HeroCarousel />

        {/* ── New Arrivals — Carousel ── */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 flex items-end justify-between">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">New In</p>
              <h2 className="font-serif text-3xl font-light text-ivory">Latest Styles</h2>
            </div>
            <Link href="/collections/all" className="text-xs uppercase tracking-widest text-ivory-muted transition hover:text-gold-400">
              Shop ALL →
            </Link>
          </div>
          <ProductCarousel products={newArrivals} />
        </section>

        {/* ── Hot Products ── */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10">
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Hot Sale</p>
            <h2 className="font-serif text-3xl font-light text-ivory">Best Sellers</h2>
          </div>
          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            {hotProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
        {/* ── Recently Viewed (returning visitors only) ── */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6">
          <RecentlyViewedSection />
        </section>
      </div>
    </>
  );
}
