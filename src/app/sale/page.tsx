'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Timer, Tag } from 'lucide-react';
import { MOCK_PRODUCTS } from '@/mock/products';
import {
  getActiveCampaign,
  getCampaignProducts,
  getCampaignPrice,
  getTimeRemaining,
  type Campaign,
} from '@/lib/campaigns';
import ProductCard from '@/components/product/ProductCard';
import QuickViewModal from '@/components/ui/QuickViewModal';
import type { Product } from '@/types';

function CountdownBanner({ campaign }: { campaign: Campaign }) {
  const [remaining, setRemaining] = useState<string | null>(getTimeRemaining(campaign.endDate));

  useEffect(() => {
    const id = setInterval(() => setRemaining(getTimeRemaining(campaign.endDate)), 60_000);
    return () => clearInterval(id);
  }, [campaign.endDate]);

  if (!remaining) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 py-2 text-xs font-medium uppercase tracking-widest"
      style={{ backgroundColor: campaign.hero.accentColor + '22', color: campaign.hero.accentColor }}
    >
      <Timer size={13} />
      {remaining}
    </div>
  );
}

export default function SalePage() {
  const campaign = getActiveCampaign();
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Products eligible for this campaign
  const saleProducts = useMemo(() => {
    if (!campaign) return [];
    return getCampaignProducts(MOCK_PRODUCTS, campaign);
  }, [campaign]);

  if (!campaign) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <Tag size={32} className="mb-4 text-gold-400/40" />
        <h1 className="font-serif text-3xl font-light text-ivory">No Active Sale</h1>
        <p className="mt-3 text-sm text-ivory-muted">
          Check back soon — seasonal offers are launched regularly.
        </p>
        <Link
          href="/collections/all"
          className="mt-6 border border-gold-400 px-6 py-3 text-xs font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
        >
          Shop All Styles
        </Link>
      </div>
    );
  }

  const discount = campaign.discount;
  const discountLabel =
    discount.type === 'percentage'
      ? `${discount.value}% off`
      : `$${discount.value} off`;

  return (
    <div>
      {/* Countdown banner */}
      <CountdownBanner campaign={campaign} />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-gold-600/20 bg-wine-900 px-4 py-16 text-center sm:py-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-5"
          style={{ background: `radial-gradient(ellipse at center, ${campaign.hero.accentColor} 0%, transparent 70%)` }}
        />
        {campaign.hero.badge && (
          <p
            className="mb-4 inline-block border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.3em]"
            style={{ borderColor: campaign.hero.accentColor + '60', color: campaign.hero.accentColor }}
          >
            {campaign.hero.badge}
          </p>
        )}
        <h1 className="font-serif text-5xl font-light text-ivory sm:text-6xl">
          {campaign.hero.title}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ivory-muted">
          {campaign.hero.subtitle}
        </p>
        <p className="mt-2 text-xs text-ivory-dim">
          Sale ends {new Date(`${campaign.endDate}T12:00:00`).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      {/* Products */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-gold-400">
              {discountLabel}
            </p>
            <h2 className="font-serif text-2xl font-light text-ivory">
              {saleProducts.length} styles included
            </h2>
          </div>
        </div>

        {saleProducts.length === 0 ? (
          <p className="py-12 text-center text-sm text-ivory-muted">
            All products qualify — browse the full collection below.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {saleProducts.map((product) => {
              // Create a campaign-priced copy to show in card without mutating original
              const salePrice = getCampaignPrice(product.price, campaign);
              const displayProduct: Product = {
                ...product,
                compareAtPrice: product.compareAtPrice ?? product.price,
                price: parseFloat(salePrice.toFixed(2)),
              };
              return (
                <ProductCard
                  key={product.id}
                  product={displayProduct}
                  onQuickView={() => setQuickViewProduct(displayProduct)}
                />
              );
            })}
          </div>
        )}
      </div>

      <QuickViewModal product={quickViewProduct} onClose={() => setQuickViewProduct(null)} />
    </div>
  );
}
