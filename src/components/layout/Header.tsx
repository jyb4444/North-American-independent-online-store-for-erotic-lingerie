'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCartStore } from '@/store/cart';
import { ShoppingBag, Search, Menu, X, LogIn, User, Package, Crown, LogOut } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import SearchModal from '@/components/ui/SearchModal';
import HeaderWishlistLink from '@/components/wishlist/HeaderWishlistLink';

export default function Header() {
  const totalItems = useCartStore((s) => s.totalItems);
  const openCart = useCartStore((s) => s.openCart);
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Prevent Zustand localStorage hydration mismatch
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navItems = [
    { href: '/collections/all', label: 'Shop ALL' },
    { href: '/collections/new-arrivals', label: 'New In' },
    { href: '/sale', label: 'Sale', highlight: true },
    { href: '/collections/sets', label: 'Sets' },
    { href: '/collections/first-free', label: 'First Free' },
    { href: '/membership', label: 'Membership' },
    { href: '/pages/about', label: 'About Us' },
  ];

  useEffect(() => {
    const supabase = createClient();

    // Get initial session
    supabase.auth.getUser().then(({ data }) => setUser(data.user));

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setUserMenuOpen(false);
  }

  const displayName = user?.user_metadata?.first_name
    ?? user?.email?.split('@')[0]
    ?? 'Account';

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  return (
    <header className="sticky top-0 z-50 border-b border-gold-600/20 bg-wine-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">

        {/* Logo */}
        <Link href="/" className="font-serif text-xl font-light italic tracking-widest text-gold-400">
          Velour
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden gap-7 md:flex">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}
              className={`text-xs font-medium uppercase tracking-widest transition hover:text-gold-400 ${
                item.highlight ? 'text-crimson-400 hover:text-crimson-300' : 'text-ivory-muted'
              }`}>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Icons */}
        <div className="flex items-center gap-5">
          <button onClick={() => setSearchOpen(true)} className="text-ivory-muted transition hover:text-gold-400">
            <Search size={17} />
          </button>
          <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
          <HeaderWishlistLink />

          {/* Not signed in */}
          {!user && (
            <Link href="/login"
              className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-ivory-muted transition hover:text-gold-400">
              <LogIn size={15} />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          )}

          {/* Signed in: avatar + dropdown */}
          {user && (
            <div ref={userMenuRef} className="relative">
              <button onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 text-ivory-muted transition hover:text-gold-400">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={displayName} width={26} height={26}
                    className="rounded-full border border-gold-600/40" />
                ) : (
                  <div className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-gold-600/40 bg-wine-800 text-xs text-gold-400">
                    {displayName[0].toUpperCase()}
                  </div>
                )}
                <span className="hidden text-xs tracking-widest sm:inline">{displayName}</span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-3 w-52 border border-gold-600/25 bg-wine-900 shadow-2xl">
                  {/* User info */}
                  <div className="border-b border-gold-600/15 px-4 py-3">
                    <p className="truncate text-xs font-medium text-ivory">{displayName}</p>
                    <p className="mt-0.5 truncate text-xs text-ivory-dim">{user.email}</p>
                  </div>

                  <nav className="py-1">
                    {[
                      { href: '/account', icon: User, label: 'My Account' },
                      { href: '/account/orders', icon: Package, label: 'Private Activity' },
                      { href: '/account/membership', icon: Crown, label: 'Style Tools' },
                    ].map(({ href, icon: Icon, label }) => (
                      <Link key={href} href={href} onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-xs text-ivory-muted transition hover:bg-wine-800 hover:text-gold-400">
                        <Icon size={13} />
                        <span className="uppercase tracking-widest">{label}</span>
                      </Link>
                    ))}
                  </nav>

                  <div className="border-t border-gold-600/15 py-1">
                    <button onClick={handleSignOut}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-xs text-ivory-dim transition hover:bg-wine-800 hover:text-crimson-400">
                      <LogOut size={13} />
                      <span className="uppercase tracking-widest">Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cart */}
          <button onClick={openCart} className="relative text-ivory-muted transition hover:text-gold-400">
            <ShoppingBag size={17} />
            {mounted && totalItems() > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold-400 text-[10px] font-bold text-wine-950">
                {totalItems()}
              </span>
            )}
          </button>

          {/* Mobile toggle */}
          <button className="text-ivory-muted transition hover:text-gold-400 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}>
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="border-t border-gold-600/20 bg-wine-900 px-4 pb-5 pt-3 md:hidden">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}
              className={`block py-2.5 text-xs font-medium uppercase tracking-widest transition hover:text-gold-400 ${
                item.highlight ? 'text-crimson-400' : 'text-ivory-muted'
              }`}
              onClick={() => setMobileOpen(false)}>
              {item.label}
            </Link>
          ))}
          <div className="mt-3 border-t border-gold-600/15 pt-3">
            {!user ? (
              <Link href="/login" className="block py-2.5 text-xs uppercase tracking-widest text-gold-400">
                Sign In
              </Link>
            ) : (
              <>
                <Link href="/account" onClick={() => setMobileOpen(false)}
                  className="block py-2.5 text-xs uppercase tracking-widest text-ivory-muted hover:text-gold-400">
                  My Account
                </Link>
                <button onClick={handleSignOut}
                  className="block py-2.5 text-xs uppercase tracking-widest text-ivory-dim hover:text-crimson-400">
                  Sign Out
                </button>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
