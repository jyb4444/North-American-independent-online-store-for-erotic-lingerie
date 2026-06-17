'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Images, Trash2 } from 'lucide-react';
import { useAiLookbook } from '@/hooks/useAiLookbook';

type Props = {
  source: 'fit_advisor' | 'account' | 'home';
  compact?: boolean;
  className?: string;
};

export default function LocalLookbookPanel({ source, compact = false, className = '' }: Props) {
  const { looks, deleteLook, trackLookbookViewed } = useAiLookbook();

  useEffect(() => {
    if (looks.length > 0) trackLookbookViewed(source);
  }, [looks.length, source, trackLookbookViewed]);

  if (looks.length === 0) return null;

  const visibleLooks = compact ? looks.slice(0, 2) : looks.slice(0, 4);

  return (
    <div className={`border border-gold-600/20 bg-wine-900 px-4 py-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Images size={14} className="text-gold-400" />
          <p className="text-xs font-medium uppercase tracking-widest text-gold-400">Your saved AI looks</p>
        </div>
        <span className="text-[10px] uppercase tracking-widest text-ivory-dim">
          Private browser save
        </span>
      </div>
      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
        {visibleLooks.map((look) => (
          <div key={look.id} className="group">
            <div className="relative aspect-[3/4] overflow-hidden bg-wine-800">
              {look.imageUrl ? (
                <Image src={look.imageUrl} alt="Saved AI look" fill sizes="140px" className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-wine-600">
                  <Images size={22} />
                </div>
              )}
              <button
                onClick={() => deleteLook(look.id, source)}
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center bg-wine-950/80 text-ivory-dim opacity-0 backdrop-blur-sm transition hover:text-crimson-400 group-hover:opacity-100"
                aria-label="Delete saved AI look"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div className="mt-2">
              {look.recommendedSize && (
                <p className="text-[10px] uppercase tracking-widest text-gold-400">
                  Size guide: {look.recommendedSize}
                </p>
              )}
              {look.productHandle && (
                <Link
                  href={`/products/${look.productHandle}`}
                  className="mt-0.5 block truncate text-xs text-ivory-dim transition hover:text-gold-400"
                >
                  View style
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ivory-dim">
        Saved looks stay on this device and are not synced to your account.
      </p>
    </div>
  );
}
