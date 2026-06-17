'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, ShoppingBag, User } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { useState, useEffect } from 'react';
import SearchModal from '@/components/ui/SearchModal';

const tabs = [
  { href: '/', icon: Home, label: 'Home' },
  { href: null, icon: Search, label: 'Search', isSearch: true },
  { href: null, icon: ShoppingBag, label: 'Bag', isCart: true },
  { href: '/account', icon: User, label: 'Account' },
] as const;

export default function MobileBottomNav() {
  const pathname = usePathname();
  const totalItems = useCartStore((s) => s.totalItems);
  const openCart = useCartStore((s) => s.openCart);
  const [mounted, setMounted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Hide on PDP (it has its own sticky ATC bar)
  const isPDP = pathname.startsWith('/products/');

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  if (isPDP) return null;

  return (
    <>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gold-600/20 bg-wine-950/95 backdrop-blur-md md:hidden">
        <div className="flex h-14 items-stretch">
          {tabs.map((tab) => {
            const isActive = tab.href ? pathname === tab.href : false;
            const Icon = tab.icon;

            if ('isCart' in tab && tab.isCart) {
              return (
                <button
                  key="cart"
                  onClick={openCart}
                  className="relative flex flex-1 flex-col items-center justify-center gap-0.5 text-ivory-dim transition hover:text-gold-400"
                >
                  <div className="relative">
                    <Icon size={19} />
                    {mounted && totalItems() > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold-400 text-[8px] font-bold text-wine-950">
                        {totalItems()}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] uppercase tracking-widest">{tab.label}</span>
                </button>
              );
            }

            if ('isSearch' in tab && tab.isSearch) {
              return (
                <button
                  key="search"
                  onClick={() => setSearchOpen(true)}
                  className="flex flex-1 flex-col items-center justify-center gap-0.5 text-ivory-dim transition hover:text-gold-400"
                >
                  <Icon size={19} />
                  <span className="text-[9px] uppercase tracking-widest">{tab.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={tab.href}
                href={tab.href!}
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 transition ${
                  isActive ? 'text-gold-400' : 'text-ivory-dim hover:text-gold-400'
                }`}
              >
                <Icon size={19} />
                <span className="text-[9px] uppercase tracking-widest">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      {/* Spacer so page content isn't hidden under the nav */}
      <div className="h-14 md:hidden" aria-hidden />
    </>
  );
}
