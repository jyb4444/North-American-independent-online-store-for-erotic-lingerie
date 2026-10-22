import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '@/types';

/** A Shopify gift card verified against a Shopify cart. Shopify deducts it at checkout. */
export type AppliedGiftCard = {
  code: string;
  lastCharacters: string;
  balance: number;
  currencyCode: string;
};

/** A Shopify checkout that was started from this bag and may have become an order. */
export type PendingCheckout = { cartId: string; startedAt: number };

type CartState = {
  items: CartItem[];
  cartOwner: string | 'guest' | null;
  isOpen: boolean;
  giftCard: AppliedGiftCard | null;
  pendingCheckout: PendingCheckout | null;
  setPendingCheckout: (pending: PendingCheckout | null) => void;
  setCartOwner: (owner: string | 'guest', preserveItems?: boolean) => void;
  addItem: (item: CartItem) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
  setItems: (items: CartItem[]) => void;
  applyGiftCard: (giftCard: AppliedGiftCard) => void;
  removeGiftCard: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      cartOwner: null,
      isOpen: false,
      giftCard: null,
      pendingCheckout: null,

      setCartOwner: (cartOwner, preserveItems = false) => set((state) => {
        if (state.cartOwner === cartOwner) return state;
        return {
          cartOwner,
          items: preserveItems ? state.items : [],
          giftCard: null,
          pendingCheckout: null,
        };
      }),

      addItem: (newItem) => {
        set((state) => {
          const existing = state.items.find((i) => i.variantId === newItem.variantId);
          if (existing) {
            const limit = Math.min(99, newItem.stock ?? existing.stock ?? 99);
            const nextQuantity = Math.min(limit, existing.quantity + newItem.quantity);
            return {
              items: state.items.map((i) =>
                i.variantId === newItem.variantId
                  ? { ...i, ...newItem, quantity: nextQuantity }
                  : i
              ),
              isOpen: true,
            };
          }
          const limit = Math.min(99, newItem.stock ?? 99);
          return {
            items: [...state.items, { ...newItem, quantity: Math.min(limit, Math.max(1, newItem.quantity)) }],
            isOpen: true,
          };
        });
      },

      removeItem: (variantId) => {
        set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) }));
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(variantId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.variantId === variantId
              ? { ...i, quantity: Math.min(Math.max(1, Math.floor(quantity)), Math.min(99, i.stock ?? 99)) }
              : i
          ),
        }));
      },

      clearCart: () => set({ items: [], giftCard: null, pendingCheckout: null }),
      setPendingCheckout: (pendingCheckout) => set({ pendingCheckout }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      setItems: (items) => set({ items }),

      applyGiftCard: (giftCard) => set({ giftCard }),
      removeGiftCard: () => set({ giftCard: null }),
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({ items: state.items, pendingCheckout: state.pendingCheckout, cartOwner: state.cartOwner }),
    }
  )
);
