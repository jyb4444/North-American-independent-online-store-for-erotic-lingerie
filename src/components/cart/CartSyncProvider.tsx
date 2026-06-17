'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/store/cart';
import type { CartItem } from '@/types';

export default function CartSyncProvider() {
  const items = useCartStore((s) => s.items);
  const setItems = useCartStore((s) => s.setItems);
  const userIdRef = useRef<string | null>(null);
  const emailRef = useRef<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false);

  async function restoreCartFromSupabase(userId: string) {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const supabase = createClient();
    const { data } = await supabase
      .from('cart_snapshots')
      .select('items')
      .eq('user_id', userId)
      .single();

    if (!data?.items) return;

    const savedItems = data.items as CartItem[];
    if (!Array.isArray(savedItems) || savedItems.length === 0) return;

    const currentItems = useCartStore.getState().items;

    if (currentItems.length === 0) {
      // No local cart — restore from Supabase directly
      setItems(savedItems);
    } else {
      // Merge: local items take priority for quantity; add any saved items not already in local cart
      const merged = [...currentItems];
      for (const saved of savedItems) {
        const exists = merged.find((i) => i.variantId === saved.variantId);
        if (!exists) merged.push(saved);
      }
      setItems(merged);
    }
  }

  useEffect(() => {
    const supabase = createClient();

    // Get initial session and restore cart if logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        userIdRef.current = user.id;
        emailRef.current = user.email ?? null;
        restoreCartFromSupabase(user.id);
      }
    });

    // Listen for auth changes (login → restore cart)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const prevUserId = userIdRef.current;
      userIdRef.current = session?.user?.id ?? null;
      emailRef.current = session?.user?.email ?? null;

      // Restore cart when a user logs in (not already restored for this user)
      if (event === 'SIGNED_IN' && session?.user && session.user.id !== prevUserId) {
        hasRestoredRef.current = false;
        restoreCartFromSupabase(session.user.id);
      }

      // Clear restored flag on sign out
      if (event === 'SIGNED_OUT') {
        hasRestoredRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save cart to Supabase for logged-in users (debounced 2s)
  useEffect(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);

    syncTimerRef.current = setTimeout(async () => {
      const userId = userIdRef.current;
      const email = emailRef.current;
      if (!userId || !email) return;

      const supabase = createClient();

      if (items.length === 0) {
        await supabase.from('cart_snapshots').delete().eq('user_id', userId);
        return;
      }

      await supabase
        .from('cart_snapshots')
        .upsert(
          {
            user_id: userId,
            email,
            items,
            reminder_sent: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
    }, 2000);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [items]);

  return null;
}
