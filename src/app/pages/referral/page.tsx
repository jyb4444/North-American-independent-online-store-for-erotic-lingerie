'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Copy, Check, Gift, LogIn } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

type ReferralData = { code: string; uses: number; rewards_earned: number };

export default function ReferralPage() {
  const [user, setUser] = useState<User | null | 'loading'>('loading');
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!user || user === 'loading') return;
    const id = window.setTimeout(() => {
      setLoading(true);
      fetch('/api/referral')
        .then((r) => r.json() as Promise<ReferralData>)
        .then((data) => setReferral(data))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(id);
  }, [user]);

  const referralUrl = referral
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/signup?ref=${referral.code}`
    : '';

  async function copyLink() {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (user === 'loading') return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      {/* Header */}
      <div className="mb-12 text-center">
        <Users size={32} className="mx-auto mb-4 text-gold-400/60" />
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Share Velour</p>
        <h1 className="font-serif text-4xl font-light text-ivory">Refer a Friend</h1>
        <p className="mt-3 text-sm leading-relaxed text-ivory-muted">
          When a friend signs up and makes their first purchase using your private link,
          you both receive a <strong className="text-ivory">$10 store credit</strong>.
        </p>
      </div>

      {/* How it works */}
      <div className="mb-12 grid gap-px bg-gold-600/10 sm:grid-cols-3">
        {[
          { step: '01', title: 'Share', desc: 'Send your private referral link to a friend you trust.' },
          { step: '02', title: 'They join', desc: 'Your friend signs up and makes their first purchase.' },
          { step: '03', title: 'Both earn', desc: 'You each receive $10 credit, applied automatically.' },
        ].map((s) => (
          <div key={s.step} className="bg-wine-900 p-6 text-center">
            <p className="font-serif text-2xl font-light text-gold-400/40">{s.step}</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-widest text-ivory">{s.title}</p>
            <p className="mt-2 text-xs leading-relaxed text-ivory-dim">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Auth gate */}
      {!user ? (
        <div className="border border-gold-600/20 bg-wine-900 p-8 text-center">
          <Gift size={24} className="mx-auto mb-3 text-gold-400/50" />
          <p className="text-sm text-ivory-muted">Sign in to get your unique referral link.</p>
          <Link
            href="/login"
            className="mt-4 inline-flex items-center gap-2 border border-gold-400 px-6 py-3 text-xs font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
          >
            <LogIn size={13} />
            Sign In
          </Link>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gold-400/30 border-t-gold-400" />
        </div>
      ) : referral ? (
        <div className="space-y-6">
          {/* Referral link */}
          <div className="border border-gold-600/25 bg-wine-900 p-6">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-ivory-muted">
              Your Private Referral Link
            </p>
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate font-mono text-xs text-ivory-dim">{referralUrl}</p>
              <button
                onClick={copyLink}
                className="flex flex-shrink-0 items-center gap-1.5 border border-gold-400 px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-3 text-[11px] text-ivory-dim">
              Code: <span className="font-mono text-gold-400/80">{referral.code}</span>
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-px bg-gold-600/10">
            <div className="bg-wine-900 p-5 text-center">
              <p className="font-serif text-3xl font-light text-ivory">{referral.uses}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-ivory-dim">Friends Referred</p>
            </div>
            <div className="bg-wine-900 p-5 text-center">
              <p className="font-serif text-3xl font-light text-gold-400">${referral.rewards_earned}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-ivory-dim">Credits Earned</p>
            </div>
          </div>

          <p className="text-center text-xs text-ivory-dim">
            Credits are applied automatically to your account after your referred friend&rsquo;s
            first purchase clears. No expiry on earned credits.
          </p>
        </div>
      ) : null}
    </div>
  );
}
