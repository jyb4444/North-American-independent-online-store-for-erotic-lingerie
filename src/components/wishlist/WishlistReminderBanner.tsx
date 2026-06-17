'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Heart, ChevronRight } from 'lucide-react';
import { useFitProfile } from '@/hooks/useFitProfile';
import { useWishlistSummary } from '@/hooks/useWishlistSummary';

type Props = {
  source: 'home' | 'account' | 'wishlist_page';
  className?: string;
  showWhenEmpty?: boolean;
};

export default function WishlistReminderBanner({ source, className = '', showWhenEmpty = false }: Props) {
  const { count, loading, isAuthenticated, trackReminderViewed, trackReminderClicked } = useWishlistSummary(3);
  const { hasProfile } = useFitProfile();

  const shouldShow = !loading && isAuthenticated && (count > 0 || showWhenEmpty);

  useEffect(() => {
    if (shouldShow) trackReminderViewed(source);
  }, [shouldShow, source, trackReminderViewed]);

  if (!shouldShow) return null;

  const title = count > 0 ? 'Your saved styles are waiting' : 'Your private wishlist is ready';
  const body = count > 0
    ? hasProfile
      ? 'Saved styles with your private fit guidance are ready when you are.'
      : 'Continue exploring styles you saved for later.'
    : 'Save styles privately so you can find them again later.';

  return (
    <div className={`border border-gold-600/20 bg-wine-900 px-5 py-4 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center border border-gold-600/30 text-gold-400">
          <Heart size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-gold-400">Private wishlist</p>
          <p className="mt-1 text-sm text-ivory">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ivory-dim">{body}</p>
        </div>
        <Link
          href="/account/wishlist"
          onClick={() => trackReminderClicked(source)}
          className="hidden items-center gap-1.5 border border-gold-400 px-4 py-2 text-[10px] font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 sm:flex"
        >
          View saved <ChevronRight size={12} />
        </Link>
      </div>
      <Link
        href="/account/wishlist"
        onClick={() => trackReminderClicked(source)}
        className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-gold-400 sm:hidden"
      >
        View saved <ChevronRight size={12} />
      </Link>
    </div>
  );
}
