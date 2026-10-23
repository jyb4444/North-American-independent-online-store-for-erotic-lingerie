'use client';

import { useEffect } from 'react';
import { EyeOff, Heart, LockKeyhole, UserRoundCheck } from 'lucide-react';
import { track } from '@/lib/analytics';

type PrivacyContext = 'product' | 'cart' | 'account' | 'home';

type Props = {
  context: PrivacyContext;
  compact?: boolean;
  className?: string;
};

const CONTEXT_ITEMS: Record<PrivacyContext, { icon: typeof LockKeyhole; text: string }[]> = {
  product: [
    { icon: Heart, text: 'Private wishlist' },
    { icon: UserRoundCheck, text: 'No public profile' },
    { icon: LockKeyhole, text: 'Product choices stay private' },
  ],
  cart: [
    { icon: LockKeyhole, text: 'Private bag' },
    { icon: Heart, text: 'Save styles privately' },
    { icon: EyeOff, text: 'Discreet browsing experience' },
  ],
  account: [
    { icon: Heart, text: 'Private wishlist' },
    { icon: UserRoundCheck, text: 'No public profile' },
    { icon: LockKeyhole, text: 'Account activity stays private' },
  ],
  home: [
    { icon: EyeOff, text: 'Discreet browsing experience' },
    { icon: Heart, text: 'Private wishlist' },
    { icon: LockKeyhole, text: 'Secure account checkout' },
  ],
};

export default function PrivacyTrustBar({ context, compact = false, className = '' }: Props) {
  const items = CONTEXT_ITEMS[context];

  useEffect(() => {
    track.privacyTrustBadgeViewed({ context, item_count: items.length });
  }, [context, items.length]);

  return (
    <div className={`border border-gold-600/15 bg-wine-900/60 ${compact ? 'px-3 py-2' : 'px-4 py-3'} ${className}`}>
      <div className={`flex flex-col gap-2 ${compact ? 'text-xs' : 'text-xs'} sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5`}>
        {items.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2 text-ivory-dim">
            <Icon size={compact ? 12 : 14} className="flex-shrink-0 text-gold-400/80" />
            <span className="leading-snug">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
