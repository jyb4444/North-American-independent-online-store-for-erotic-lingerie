'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { track } from '@/lib/analytics';
import { notifyWishlistChanged } from '@/hooks/useWishlistSummary';
import { useOnboardingTasks } from '@/hooks/useOnboardingTasks';
import type { Product } from '@/types';

type Props = {
  product: Product;
  variant?: 'button' | 'icon';
  source?: string;
  className?: string;
};

export default function WishlistButton({
  product,
  variant = 'button',
  source = 'product_detail',
  className = '',
}: Props) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [insertError, setInsertError] = useState('');
  // For icon variant: briefly flash an error state
  const [iconErr, setIconErr] = useState(false);
  const errTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { markTaskCompleted } = useOnboardingTasks();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      supabase
        .from('wishlists')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle()
        .then(({ data }) => {
          setSaved(!!data);
          setLoading(false);
        });
    }).catch(() => setLoading(false));
  }, [product.id, supabase]);

  useEffect(() => () => {
    if (errTimerRef.current) clearTimeout(errTimerRef.current);
  }, []);

  function flashIconError() {
    setIconErr(true);
    if (errTimerRef.current) clearTimeout(errTimerRef.current);
    errTimerRef.current = setTimeout(() => setIconErr(false), 2500);
  }

  async function toggle() {
    if (!userId) {
      router.push('/login');
      return;
    }

    setInsertError('');

    if (saved) {
      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', product.id);
      if (error) {
        setInsertError('Could not remove this style. Please try again.');
        flashIconError();
        return;
      }
      setSaved(false);
      notifyWishlistChanged();
      track.wishlistRemoved({ product_id: product.id, product_handle: product.handle, source });
    } else {
      const { error } = await supabase.from('wishlists').insert({
        user_id: userId,
        product_id: product.id,
        product_handle: product.handle,
        product_title: product.title,
        product_image: product.images[0] ?? null,
        product_price: product.price,
      });
      if (error) {
        setInsertError('Could not save this style. Please try again.');
        flashIconError();
        return;
      }
      setSaved(true);
      notifyWishlistChanged();
      track.wishlistAdded({ product_id: product.id, product_handle: product.handle, source });
      markTaskCompleted('first_item_saved', source);
      void fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'wishlist_reminder',
          productTitle: product.title,
          productImage: product.images[0] ?? '',
          productHandle: product.handle,
        }),
      }).catch(() => {});
    }
  }

  if (loading) return null;

  const saveLabel = !userId ? 'Sign in to save' : saved ? 'Saved' : 'Save';

  if (variant === 'icon') {
    const iconTitle = iconErr
      ? 'Could not save — please try again'
      : !userId
      ? 'Sign in to save'
      : saved
      ? 'Remove from wishlist'
      : 'Save to wishlist';

    return (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void toggle();
        }}
        title={iconTitle}
        aria-label={iconTitle}
        className={`flex h-9 w-9 items-center justify-center border backdrop-blur-sm transition ${
          iconErr
            ? 'border-crimson-400/60 bg-wine-950/85 text-crimson-400'
            : saved
            ? 'border-crimson-600/50 bg-wine-950/85 text-crimson-400'
            : 'border-gold-600/25 bg-wine-950/70 text-ivory-muted hover:border-gold-400/60 hover:text-gold-400'
        } ${className}`}
      >
        <Heart
          size={15}
          className={saved ? 'fill-crimson-400' : iconErr ? 'fill-crimson-400/40' : ''}
        />
      </button>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        title={!userId ? 'Sign in to save' : saved ? 'Remove from wishlist' : 'Save to wishlist'}
        className={`flex w-full items-center gap-2 border py-4 text-xs font-medium uppercase tracking-[0.2em] transition ${
          saved
            ? 'border-crimson-600/50 text-crimson-400 hover:bg-crimson-700/10'
            : 'border-wine-700 text-ivory-muted hover:border-gold-400/50 hover:text-gold-400'
        }`}
      >
        <Heart size={15} className={saved ? 'fill-crimson-400' : ''} />
        {saveLabel}
      </button>
      {insertError && (
        <p className="mt-1 text-[11px] text-crimson-400">{insertError}</p>
      )}
    </div>
  );
}
