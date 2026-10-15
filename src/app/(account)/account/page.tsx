import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Package, MapPin, Heart, ChevronRight, UserCog, PackageSearch } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getOrdersForUser, syncShopifyOrdersForUser } from '@/lib/logistics';
import LocalLookbookPanel from '@/components/ai/LocalLookbookPanel';
import NewUserTaskChecklist from '@/components/onboarding/NewUserTaskChecklist';
import WishlistReminderBanner from '@/components/wishlist/WishlistReminderBanner';

function formatDate(value: string | null) {
  if (!value) return 'Pending';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function money(value: number | null, currency: string) {
  if (value === null) return '';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

function statusLabel(status: string | null) {
  if (!status) return 'Preparing';
  return status.replace(/_/g, ' ');
}

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const displayName = user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? 'Member';
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  if (user.email) {
    await syncShopifyOrdersForUser({ userId: user.id, email: user.email, limit: 5 });
  }

  const orders = (await getOrdersForUser(user.id)).slice(0, 3);

  const quickLinks = [
    { href: '/account/orders', icon: Package, label: 'Order History', sub: 'Purchases and returns' },
    { href: '/track', icon: PackageSearch, label: 'Track Package', sub: 'Order status lookup' },
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
        <WishlistReminderBanner source="account" />
        <LocalLookbookPanel source="account" />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left column */}
        <div className="space-y-5 md:col-span-1">
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
            <h2 className="font-serif text-xl font-light text-ivory">Order History</h2>
            <Link href="/account/orders" className="text-xs uppercase tracking-widest text-gold-400/70 transition hover:text-gold-400">
              View all →
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center border border-gold-600/20 bg-wine-900 text-center">
              <Package size={28} className="mb-3 text-wine-700" />
              <p className="font-serif text-lg font-light italic text-ivory-muted">Your private dashboard is ready</p>
              <Link href="/" className="mt-3 text-xs uppercase tracking-widest text-gold-400 hover:underline">Explore private styles</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.id} className="border border-gold-600/20 bg-wine-900 p-5 transition hover:border-gold-400/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-ivory">#{order.shopify_order_number}</p>
                      <p className="mt-0.5 text-xs text-ivory-dim">{formatDate(order.processed_at ?? order.created_at)}</p>
                    </div>
                    <span className="border border-gold-600/40 px-3 py-0.5 text-[10px] font-medium uppercase tracking-widest text-gold-400">
                      {statusLabel(order.fulfillment_status)}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-gold-600/10 pt-3 text-xs">
                    <span className="text-ivory-dim">{order.shipments.length} shipment{order.shipments.length === 1 ? '' : 's'}</span>
                    <span className="font-serif text-base text-gold-400">{money(order.total_amount, order.currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
