import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Package, Crown, MapPin, Heart, ChevronRight, UserCog } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import LocalLookbookPanel from '@/components/ai/LocalLookbookPanel';
import NewUserTaskChecklist from '@/components/onboarding/NewUserTaskChecklist';
import DailyRewardCard from '@/components/rewards/DailyRewardCard';
import WishlistReminderBanner from '@/components/wishlist/WishlistReminderBanner';

function getTier(name: string) {
  if (name === 'gold') return { name: 'Gold', color: 'text-yellow-400', border: 'border-yellow-400/40', bg: 'bg-yellow-400/10', next: null };
  if (name === 'silver') return { name: 'Silver', color: 'text-zinc-300', border: 'border-zinc-300/40', bg: 'bg-zinc-300/10', next: 'Gold' };
  return { name: 'Bronze', color: 'text-gold-400', border: 'border-gold-400/40', bg: 'bg-gold-400/10', next: 'Silver' };
}

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch membership from DB
  const { data: membership } = await supabase
    .from('memberships')
    .select('tier')
    .eq('user_id', user.id)
    .single();

  const tier = getTier((membership as { tier?: string } | null)?.tier ?? 'bronze');

  const displayName = user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? 'Member';
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  // TODO: fetch real orders after ordering is connected.
  const mockOrders: { id: string; date: string; status: string; total: string; items: number }[] = [];

  const quickLinks = [
    { href: '/account/orders', icon: Package, label: 'Style Activity', sub: 'Private history' },
    { href: '/account/membership', icon: Crown, label: 'Style Tools', sub: `${tier.name} preview` },
    { href: '/account/wishlist', icon: Heart, label: 'Wishlist', sub: 'Saved styles' },
    { href: '/account/addresses', icon: MapPin, label: 'Details', sub: 'Private account info' },
    { href: '/account/profile', icon: UserCog, label: 'Edit Profile', sub: 'Account preferences' },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">

      {/* Profile header */}
      <div className="mb-10 flex items-center gap-5">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={displayName} width={64} height={64}
            className="rounded-full border border-gold-600/40" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-gold-600/40 bg-wine-800 font-serif text-2xl font-light text-gold-400">
            {displayName[0].toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="font-serif text-3xl font-light text-ivory">
            {user.user_metadata?.first_name
              ? `${user.user_metadata.first_name} ${user.user_metadata.last_name ?? ''}`
              : displayName}
          </h1>
          <p className="mt-1 text-xs text-ivory-dim">{user.email}</p>
        </div>
      </div>

      <div className="mb-6 space-y-4">
        <NewUserTaskChecklist source="account" />
        <DailyRewardCard source="account" compact />
        <WishlistReminderBanner source="account" />
        <LocalLookbookPanel source="account" />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column */}
        <div className="space-y-5 md:col-span-1">

          {/* Membership card */}
          <div className={`relative overflow-hidden border ${tier.border} bg-wine-900 p-6`}>
            <span className="absolute right-4 top-4 font-serif text-lg text-gold-600/20 select-none">✦</span>
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.3em] text-ivory-dim">Membership</p>
            <p className={`font-serif text-2xl font-light italic ${tier.color}`}>{tier.name}</p>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-serif text-xl text-gold-400">Private</span>
              <span className="text-xs uppercase tracking-widest text-ivory-dim">style tools</span>
            </div>
            <Link href="/account/membership" className="mt-4 block text-xs uppercase tracking-widest text-gold-400/70 transition hover:text-gold-400">
              View setup tools →
            </Link>
          </div>

          {/* Quick links */}
          <div className="border border-gold-600/20 bg-wine-900">
            {quickLinks.map(({ href, icon: Icon, label, sub }, i) => (
              <Link key={href} href={href}
                className={`flex items-center justify-between px-4 py-3.5 transition hover:bg-wine-800 ${i < quickLinks.length - 1 ? 'border-b border-gold-600/10' : ''}`}>
                <div className="flex items-center gap-3">
                  <Icon size={14} className="flex-shrink-0 text-gold-400/70" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-widest text-ivory-muted">{label}</p>
                    <p className="text-xs text-ivory-dim">{sub}</p>
                  </div>
                </div>
                <ChevronRight size={13} className="text-ivory-dim" />
              </Link>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="md:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-serif text-xl font-light text-ivory">Private Activity</h2>
            <Link href="/account/orders" className="text-xs uppercase tracking-widest text-gold-400/70 transition hover:text-gold-400">
              View all →
            </Link>
          </div>

          {mockOrders.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center border border-gold-600/20 bg-wine-900 text-center">
              <Package size={28} className="mb-3 text-wine-700" />
              <p className="font-serif text-lg font-light italic text-ivory-muted">Your private dashboard is ready</p>
              <Link href="/" className="mt-3 text-xs uppercase tracking-widest text-gold-400 hover:underline">Explore private styles</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {mockOrders.map((order) => (
                <div key={order.id} className="border border-gold-600/20 bg-wine-900 p-5 transition hover:border-gold-400/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-ivory">{order.id}</p>
                      <p className="mt-0.5 text-xs text-ivory-dim">{order.date}</p>
                    </div>
                    <span className="border border-gold-600/40 px-3 py-0.5 text-[10px] font-medium uppercase tracking-widest text-gold-400">
                      {order.status}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-gold-600/10 pt-3 text-xs">
                    <span className="text-ivory-dim">{order.items} item{order.items > 1 ? 's' : ''}</span>
                    <span className="font-serif text-base text-gold-400">{order.total}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tier perks */}
          <div className={`mt-6 border ${tier.border} ${tier.bg} p-5`}>
            <div className="mb-3 flex items-center gap-2">
              <Crown size={14} className={tier.color} />
              <p className={`text-xs font-medium uppercase tracking-[0.2em] ${tier.color}`}>{tier.name} Style Tools</p>
            </div>
            <ul className="space-y-1.5 text-xs text-ivory-muted">
              {tier.name === 'Bronze' && <>
                <li>✦ Private wishlist tools</li>
                <li>✦ Early access to new arrivals</li>
                <li>✦ Saved fit guidance</li>
              </>}
              {tier.name === 'Silver' && <>
                <li>✦ Private wishlist tools</li>
                <li>✦ Fit-guided style setup</li>
                <li>✦ Priority styling support</li>
              </>}
              {tier.name === 'Gold' && <>
                <li>✦ Private wishlist tools</li>
                <li>✦ Saved AI look references</li>
                <li>✦ Dedicated styling support</li>
                <li>✦ First access to limited editions</li>
              </>}
            </ul>
            {tier.next && (
              <p className="mt-3 text-xs text-ivory-dim">
                Continue your private setup to preview more guided style tools.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
