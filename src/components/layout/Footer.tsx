'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Mail } from 'lucide-react';

function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setError('');
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not join right now. Please try again.');
      setState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join right now. Please try again.');
      setState('error');
    }
  }

  if (state === 'success') {
    return (
      <p role="status" aria-live="polite" className="text-xs text-gold-400">
        You&rsquo;re on the list. Welcome to Self Love.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={state === 'sending'} className="mt-2 flex flex-col gap-2">
      {state === 'error' && <p role="alert" className="border border-crimson-400 bg-red-50 p-2 text-xs text-crimson-600">{error}</p>}
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="your@email.com"
          className="min-w-0 flex-1 border border-wine-700 bg-wine-800 px-3 py-2 text-xs text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="flex-shrink-0 border border-gold-400 px-3 py-2 text-[10px] font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 disabled:opacity-50"
        >
          {state === 'sending' ? 'Joining…' : 'Join'}
        </button>
      </div>
      <p className="text-[10px] text-ivory-dim">Sent discreetly. Unsubscribe anytime.</p>
    </form>
  );
}

export default function Footer() {
  return (
    <footer className="border-t border-gold-600/20 bg-wine-900 py-16 text-ivory-dim">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">

        {/* Brand + divider */}
        <div className="mb-12 text-center">
          <Image
            src="/logo.png"
            alt="Self Love"
            width={72}
            height={72}
            className="mx-auto h-16 w-16 rounded-full object-cover"
          />
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.24em] text-ivory">Self Love</p>
          <div className="mx-auto mt-3 h-px w-12 bg-gold-600/40" />
        </div>

        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.3em] text-ivory-muted">
              About
            </p>
            <p className="text-xs leading-relaxed">
              Premium intimate apparel with discreet shopping and curated essentials.
            </p>
            <div className="mt-6">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.2em] text-ivory-muted">
                <Mail size={11} /> Private Access
              </p>
              <NewsletterForm />
            </div>
          </div>

          <div>
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.3em] text-ivory-muted">Shop</p>
            <ul className="space-y-2.5 text-xs">
              {[['Shop ALL', '/collections/all'], ['SALES', '/sale'], ['Hosiery', '/collections/hosiery']].map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="transition hover:text-gold-400">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.3em] text-ivory-muted">Help</p>
            <ul className="space-y-2.5 text-xs">
              {[['Size Guide', '/pages/size-guide'], ['Fulfillment Notes', '/pages/shipping'],
                ['Returns', '/pages/returns'], ['FAQ', '/pages/faq'],
                ['Track Order', '/track'], ['Contact Us', '/pages/contact']].map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="transition hover:text-gold-400">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-5 text-xs font-medium uppercase tracking-[0.3em] text-ivory-muted">Account</p>
            <ul className="space-y-2.5 text-xs">
              {[['My Account', '/account'], ['Order History', '/account/orders'],
                ['Return Items', '/returns'],
                ['Track Package', '/track'],
                ['Gift Cards', '/pages/gift-card'],
                ['Referral Program', '/pages/referral']].map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="transition hover:text-gold-400">{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-gold-600/10 pt-8 text-xs md:flex-row">
          <p>© {new Date().getFullYear()} Self Love. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/pages/privacy" className="hover:text-gold-400 transition">Privacy Policy</Link>
            <Link href="/pages/terms" className="hover:text-gold-400 transition">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
