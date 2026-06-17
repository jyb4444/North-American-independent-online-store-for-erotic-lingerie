import Link from 'next/link';
import HeroCarousel from '@/components/ui/HeroCarousel';
import ProductCarousel from '@/components/ui/ProductCarousel';
import ProductCard from '@/components/product/ProductCard';
import DailyRewardCard from '@/components/rewards/DailyRewardCard';
import RecentlyViewedSection from '@/components/ui/RecentlyViewedSection';
import { MOCK_PRODUCTS, getBestsellers, getNewArrivals } from '@/mock/products';

export default function HomePage() {
  const newArrivals = getNewArrivals();
  const hotProducts = [...getBestsellers(), ...MOCK_PRODUCTS]
    .filter((product, index, products) => products.findIndex((p) => p.id === product.id) === index)
    .sort((a, b) => Number(b.isBestseller) - Number(a.isBestseller) || b.rating - a.rating)
    .slice(0, 8);

  return (
    <div className="space-y-20 pb-24">

      {/* ── Hero Carousel ── */}
      <HeroCarousel />

      {/* ── Daily Reward ── */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <DailyRewardCard source="home" />
      </div>

      {/* ── New Arrivals — Carousel ── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">New In</p>
            <h2 className="font-serif text-3xl font-light text-ivory">Latest Styles</h2>
          </div>
          <Link href="/collections/new-arrivals" className="text-xs uppercase tracking-widest text-ivory-muted transition hover:text-gold-400">
            View All →
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
  );
}
