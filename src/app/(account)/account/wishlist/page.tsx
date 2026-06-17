'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Heart, Trash2, ShoppingBag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/store/cart';
import { track } from '@/lib/analytics';
import { notifyWishlistChanged } from '@/hooks/useWishlistSummary';
import WishlistReminderBanner from '@/components/wishlist/WishlistReminderBanner';
import { MOCK_PRODUCTS } from '@/mock/products';
import type { Database } from '@/lib/supabase/types';

type WishlistRow = Database['public']['Tables']['wishlists']['Row'];

export default function WishlistPage() {
  const router = useRouter();
  const [items, setItems] = useState<WishlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const addItem = useCartStore((s) => s.addItem);
  const supabase = useMemo(() => createClient(), []);

  const fetchWishlist = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('wishlists')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login');
        return;
      }
      fetchWishlist(user.id);
    });
  }, [fetchWishlist, router, supabase]);

  async function removeItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item || removingId) return;

    setRemovingId(id);
    setMessage('');

    try {
      await supabase.from('wishlists').delete().eq('id', id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      notifyWishlistChanged();
      track.wishlistRemoved({
        product_id: item.product_id,
        product_handle: item.product_handle,
        source: 'wishlist_page',
      });
    } finally {
      setRemovingId(null);
    }
  }

  async function moveToBag(item: WishlistRow) {
    if (movingId) return;

    setMovingId(item.id);
    setMessage('');

    try {
      const product = MOCK_PRODUCTS.find((p) => p.id === item.product_id || p.handle === item.product_handle);
      const variant = product?.variants[0];

      if (!product || !variant) {
        setMessage('This style is no longer available. It has been kept in your wishlist.');
        return;
      }

      addItem({
        variantId: variant.id,
        productId: item.product_id,
        title: item.product_title,
        image: item.product_image ?? product.images[0] ?? '',
        price: item.product_price ?? product.price,
        size: variant.size,
        color: variant.color,
        colorHex: variant.colorHex,
        quantity: 1,
      });
      track.addedToCart(product, variant, 1);

      await supabase.from('wishlists').delete().eq('id', item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      notifyWishlistChanged();
      track.wishlistRemoved({
        product_id: item.product_id,
        product_handle: item.product_handle,
        source: 'wishlist_move_to_bag',
      });
      setMessage('Moved to your private bag.');
    } catch {
      setMessage('Could not move this style. Please try again.');
    } finally {
      setMovingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Account</p>
          <h1 className="font-serif text-3xl font-light text-ivory">Wishlist</h1>
        </div>
        <Link href="/account" className="text-xs uppercase tracking-widest text-ivory-dim transition hover:text-gold-400">
          ← Account
        </Link>
      </div>

      <WishlistReminderBanner source="wishlist_page" showWhenEmpty />

      {items.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center border border-gold-600/20 bg-wine-900 text-center">
          <Heart size={36} className="mb-4 text-wine-700" />
          <p className="font-serif text-xl font-light italic text-ivory-muted">Your wishlist is empty</p>
          <p className="mt-2 text-xs text-ivory-dim">Save styles privately so you can compare them later.</p>
          <Link href="/" className="mt-5 border border-gold-400 px-6 py-2.5 text-xs uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950">
            Browse Collection
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ivory-dim">{items.length} saved style{items.length !== 1 ? 's' : ''}</p>
            {message && <p className="text-xs text-green-400">{message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <div key={item.id} className="group relative">
                {/* Image */}
                <div className="relative aspect-[3/4] overflow-hidden bg-wine-800">
                  <Link href={`/products/${item.product_handle}`} className="block h-full">
                    {item.product_image ? (
                      <Image
                        src={item.product_image}
                        alt={item.product_title}
                        fill
                        sizes="(max-width:640px) 50vw, 25vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Heart size={24} className="text-wine-700" />
                      </div>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void removeItem(item.id)}
                    disabled={removingId === item.id}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center bg-wine-950/80 text-ivory-dim backdrop-blur-sm transition hover:text-crimson-400 disabled:cursor-wait disabled:text-wine-600"
                    aria-label="Remove from wishlist"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Info */}
                <div className="mt-2.5 space-y-1">
                  <Link href={`/products/${item.product_handle}`}
                    className="block text-xs font-light text-ivory transition hover:text-gold-400 line-clamp-2">
                    {item.product_title}
                  </Link>
                  {item.product_price && (
                    <p className="font-serif text-sm text-gold-400">${item.product_price.toFixed(2)}</p>
                  )}
                  <div className="grid gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => void moveToBag(item)}
                      disabled={movingId === item.id}
                      className="flex items-center justify-center gap-1.5 border border-gold-400 px-3 py-2 text-[10px] font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 disabled:cursor-wait disabled:border-wine-700 disabled:text-wine-600"
                    >
                      <ShoppingBag size={11} />
                      {movingId === item.id ? 'Moving...' : 'Move to Bag'}
                    </button>
                    <Link
                      href={`/products/${item.product_handle}`}
                      className="text-center text-[10px] uppercase tracking-widest text-ivory-dim transition hover:text-gold-400"
                    >
                      Edit style
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
