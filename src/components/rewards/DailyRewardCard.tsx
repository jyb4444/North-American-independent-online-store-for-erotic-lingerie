'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronRight, Gift, Sparkles, X } from 'lucide-react';
import { useDailyReward } from '@/hooks/useDailyReward';

type Props = {
  source: 'home' | 'account' | 'membership';
  compact?: boolean;
  className?: string;
};

export default function DailyRewardCard({ source, compact = false, className = '' }: Props) {
  const {
    reward,
    isDismissedToday,
    isRevealedToday,
    loading,
    reveal,
    dismiss,
    trackViewed,
    trackCtaClicked,
  } = useDailyReward(source);
  const viewedRef = useRef('');

  useEffect(() => {
    if (loading || isDismissedToday) return;
    const viewKey = `${source}:${reward.id}:${isRevealedToday ? 'open' : 'closed'}`;
    if (viewedRef.current === viewKey) return;
    viewedRef.current = viewKey;
    trackViewed();
  }, [isDismissedToday, isRevealedToday, loading, reward.id, source, trackViewed]);

  if (loading || isDismissedToday) return null;

  return (
    <div className={`border border-gold-600/20 bg-wine-900 px-4 py-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center border border-gold-600/30 text-gold-400">
            {isRevealedToday ? <Sparkles size={15} /> : <Gift size={15} />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-gold-400">
              Daily private perk
            </p>
            {isRevealedToday ? (
              <>
                <h2 className={`${compact ? 'text-base' : 'text-lg'} mt-1 font-serif font-light text-ivory`}>
                  {reward.title}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-ivory-dim">
                  {reward.description}
                </p>
              </>
            ) : (
              <>
                <h2 className={`${compact ? 'text-base' : 'text-lg'} mt-1 font-serif font-light text-ivory`}>
                  A private style note is ready
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-ivory-dim">
                  Reveal the daily gentle shopping tip. Private to this browser for now.
                </p>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-ivory-dim transition hover:text-gold-400"
          aria-label="Dismiss daily private perk"
        >
          <X size={15} />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        {isRevealedToday ? (
          <>
            {reward.ctaHref && reward.ctaLabel && (
              <Link
                href={reward.ctaHref}
                onClick={trackCtaClicked}
                className="inline-flex items-center justify-center gap-1.5 border border-gold-400 px-4 py-2.5 text-[10px] font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
              >
                {reward.ctaLabel}
                <ChevronRight size={12} />
              </Link>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="px-4 py-2.5 text-[10px] font-medium uppercase tracking-widest text-ivory-dim transition hover:text-gold-400"
            >
              Save for later
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={reveal}
            className="inline-flex items-center justify-center gap-2 border border-gold-400 px-4 py-2.5 text-[10px] font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
          >
            <Sparkles size={12} />
            Reveal the daily private tip
          </button>
        )}
      </div>
    </div>
  );
}
