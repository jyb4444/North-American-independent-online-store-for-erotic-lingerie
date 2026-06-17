import type { Product } from '@/types';

export type DiscountRule = {
  type: 'percentage' | 'fixed';
  value: number;
  applyTo: 'all' | { tags?: string[]; categories?: string[] };
};

export type Campaign = {
  id: string;
  name: string;
  slug: string;
  startDate: string; // ISO date string "YYYY-MM-DD"
  endDate: string;   // ISO date string "YYYY-MM-DD"
  hero: {
    title: string;
    subtitle: string;
    accentColor: string;
    badge?: string;
  };
  discount: DiscountRule;
  featuredTags?: string[];
};

// ─────────────────────────────────────────────────────────
// ADD / EDIT campaigns here. Never touch product prices.
// ─────────────────────────────────────────────────────────
export const CAMPAIGNS: Campaign[] = [
  {
    id: 'valentines-2027',
    name: "Valentine's Day",
    slug: 'valentines',
    startDate: '2027-02-07',
    endDate: '2027-02-14',
    hero: {
      title: "Valentine's Edit",
      subtitle: 'Curated styles for your most intimate moments. Limited time.',
      accentColor: '#b91c1c',
      badge: '❤ Up to 20% off',
    },
    discount: { type: 'percentage', value: 20, applyTo: 'all' },
    featuredTags: ['corset', 'babydoll', 'set', 'lace'],
  },
  {
    id: 'summer-sale-2027',
    name: 'Summer Sale',
    slug: 'summer',
    startDate: '2027-06-20',
    endDate: '2027-07-04',
    hero: {
      title: 'Summer Edit',
      subtitle: 'Lightweight silhouettes, elevated comfort. For warm nights.',
      accentColor: '#c9a84c',
      badge: 'Up to 15% off',
    },
    discount: { type: 'percentage', value: 15, applyTo: { categories: ['chemise', 'robe', 'babydoll'] } },
    featuredTags: ['chemise', 'robe', 'babydoll'],
  },
  {
    id: 'black-friday-2027',
    name: 'Black Friday',
    slug: 'black-friday',
    startDate: '2027-11-28',
    endDate: '2027-12-01',
    hero: {
      title: 'Black Friday',
      subtitle: 'Our biggest discount of the year — 72 hours only.',
      accentColor: '#c9a84c',
      badge: '25% off everything',
    },
    discount: { type: 'percentage', value: 25, applyTo: 'all' },
    featuredTags: [],
  },
];

// ─────────────────────────────────────────────────────────
// Helpers — consumed by pages and price displays
// ─────────────────────────────────────────────────────────

export function getActiveCampaign(now: Date = new Date()): Campaign | null {
  const today = now.toISOString().slice(0, 10);
  return CAMPAIGNS.find((c) => c.startDate <= today && today <= c.endDate) ?? null;
}

export function getCampaignBySlug(slug: string): Campaign | null {
  return CAMPAIGNS.find((c) => c.slug === slug) ?? null;
}

export function productMatchesCampaign(product: Product, campaign: Campaign): boolean {
  const rule = campaign.discount.applyTo;
  if (rule === 'all') return true;
  if (rule.categories && rule.categories.includes(product.category)) return true;
  if (rule.tags && product.tags.some((t) => rule.tags!.includes(t))) return true;
  return false;
}

export function getCampaignPrice(basePrice: number, campaign: Campaign): number {
  const { type, value } = campaign.discount;
  if (type === 'percentage') {
    return Math.max(0, basePrice * (1 - value / 100));
  }
  return Math.max(0, basePrice - value);
}

export function getCampaignProducts(products: Product[], campaign: Campaign): Product[] {
  return products.filter((p) => productMatchesCampaign(p, campaign));
}

export function getTimeRemaining(endDate: string): string | null {
  const end = new Date(`${endDate}T23:59:59`);
  const now = new Date();
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h remaining`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${mins}m remaining`;
}
