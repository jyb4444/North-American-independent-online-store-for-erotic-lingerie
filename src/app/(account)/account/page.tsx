import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Package, Heart, ChevronRight, UserCog, PackageSearch, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import WishlistReminderBanner from '@/components/wishlist/WishlistReminderBanner';

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const displayName = user.user_metadata?.first_name ?? user.email?.split('@')[0] ?? 'Member';
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  const quickLinks = [
    { href: '/account/orders', icon: Package, label: 'Order History', sub: 'Purchases and returns' },
    { href: '/track', icon: PackageSearch, label: 'Track Package', sub: 'Order status lookup' },
    { href: '/account/wishlist', icon: Heart, label: 'Wishlist', sub: 'Saved styles' },
    { href: '/account/profile', icon: UserCog, label: 'Edit Profile', sub: 'Name, password and addresses' },
  ];
  if (user.app_metadata?.role === 'admin') {
    quickLinks.push({ href: '/admin/operations', icon: ShieldAlert, label: 'Store Operations', sub: 'Returns, reviews and failed jobs' });
  }

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
        <WishlistReminderBanner source="account" />
      </div>

      <div>
        <h2 className="mb-5 font-serif text-xl font-light text-ivory">Account Shortcuts</h2>
        <div data-testid="account-shortcuts" className="grid gap-4 sm:grid-cols-2">
          {quickLinks.map(({ href, icon: Icon, label, sub }) => (
            <Link key={href} href={href}
              className="group flex min-h-32 items-start justify-between border border-gold-600/20 bg-wine-900 p-5 transition hover:border-gold-400/50 hover:bg-wine-800">
              <div>
                <Icon size={20} className="mb-4 text-gold-400/80" />
                <p className="text-xs font-medium uppercase tracking-widest text-ivory-muted">{label}</p>
                <p className="mt-1 text-xs leading-5 text-ivory-dim">{sub}</p>
              </div>
              <ChevronRight size={15} className="mt-1 shrink-0 text-ivory-dim transition group-hover:translate-x-0.5 group-hover:text-gold-400" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
