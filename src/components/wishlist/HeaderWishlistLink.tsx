'use client';

import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useWishlistSummary } from '@/hooks/useWishlistSummary';
import { track } from '@/lib/analytics';

export default function HeaderWishlistLink() {
  const { count, isAuthenticated, loading } = useWishlistSummary(1);

  if (loading) return null;

  return (
    <Link
      href={isAuthenticated ? '/account/wishlist' : '/login'}
      aria-label={isAuthenticated ? 'Private wishlist' : 'Sign in to save styles'}
      title={isAuthenticated ? undefined : 'Sign in to save styles'}
      onClick={() => {
        track.wishlistCountViewed({
          saved_count: count,
          source: 'header',
          is_authenticated: isAuthenticated,
        });
      }}
      className="relative text-ivory-muted transition hover:text-gold-400"
    >
      <Heart size={17} />
      {isAuthenticated && count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-400 px-1 text-[10px] font-bold text-wine-950">
          {count}
        </span>
      )}
    </Link>
  );
}
