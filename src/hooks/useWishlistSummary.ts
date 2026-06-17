'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { track } from '@/lib/analytics';
import type { Database } from '@/lib/supabase/types';

export const WISHLIST_CHANGED_EVENT = 'velour_wishlist_changed';

export type WishlistSummaryItem = Pick<
  Database['public']['Tables']['wishlists']['Row'],
  'id' | 'product_id' | 'product_handle' | 'product_image' | 'product_price'
>;

type WishlistSummaryState = {
  count: number;
  items: WishlistSummaryItem[];
  loading: boolean;
  error: string;
  isAuthenticated: boolean;
};

export function notifyWishlistChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(WISHLIST_CHANGED_EVENT));
}

export function useWishlistSummary(limit = 4) {
  const [state, setState] = useState<WishlistSummaryState>({
    count: 0,
    items: [],
    loading: true,
    error: '',
    isAuthenticated: false,
  });

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      setState({ count: 0, items: [], loading: false, error: '', isAuthenticated: false });
      return;
    }

    const { data, count, error } = await supabase
      .from('wishlists')
      .select('id, product_id, product_handle, product_image, product_price', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      setState({ count: 0, items: [], loading: false, error: error.message, isAuthenticated: true });
      return;
    }

    setState({
      count: count ?? data?.length ?? 0,
      items: data ?? [],
      loading: false,
      error: '',
      isAuthenticated: true,
    });
  }, [limit]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => {
      refresh();
    }, 0);

    function handleAuthOrWishlistChange() {
      refresh();
    }

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthOrWishlistChange);
    window.addEventListener(WISHLIST_CHANGED_EVENT, handleAuthOrWishlistChange);

    return () => {
      window.clearTimeout(initialRefresh);
      subscription.unsubscribe();
      window.removeEventListener(WISHLIST_CHANGED_EVENT, handleAuthOrWishlistChange);
    };
  }, [refresh]);

  const trackReminderViewed = useCallback((source: string) => {
    track.wishlistReminderViewed({
      saved_count: state.count,
      source,
      is_authenticated: state.isAuthenticated,
    });
  }, [state.count, state.isAuthenticated]);

  const trackReminderClicked = useCallback((source: string) => {
    track.wishlistReminderClicked({
      saved_count: state.count,
      source,
      is_authenticated: state.isAuthenticated,
    });
  }, [state.count, state.isAuthenticated]);

  return { ...state, refresh, trackReminderViewed, trackReminderClicked };
}
