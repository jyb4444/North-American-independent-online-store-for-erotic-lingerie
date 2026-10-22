'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Copy, Check, Gift, LogIn } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { publicReferralRewardSettings, referralMarketingEnabled } from '@/lib/referral-public';

type Reward = { code: string; amount: number; minimum_subtotal: number; kind: 'welcome' | 'referrer'; status: 'pending' | 'processing' | 'issued' | 'failed' | 'manual_review'; created_at: string };
type ReferralData = {
  code: string;
  uses: number;
  rewards_earned: number;
  rewards: Reward[];
  rewardsEnabled: boolean;
  settings: { amount: number; minimumSubtotal: number };
};

export default function ReferralPage() {
  const rewardsEnabled = referralMarketingEnabled();
  const rewardSettings = publicReferralRewardSettings();
  const [user, setUser] = useState<User | null | 'loading'>('loading');
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!rewardsEnabled) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, [rewardsEnabled]);

  useEffect(() => {
    if (!user || user === 'loading') return;
    const id = window.setTimeout(() => {
      setLoading(true);
      fetch('/api/referral')
        .then((r) => { if (!r.ok) throw new Error('Your referral link is temporarily unavailable. Please try again later.'); return r.json() as Promise<ReferralData>; })
        .then((data) => { setReferral(data); setError(''); })
        .catch((error: Error) => setError(error.message))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(id);
  }, [user]);

  const referralUrl = referral
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/login?ref=${encodeURIComponent(referral.code)}`
    : '';

  async function copyLink() {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (!rewardsEnabled) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <Gift size={30} className="mx-auto mb-4 text-ivory-dim" />
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-ivory-dim">Referral Program</p>
        <h1 className="font-serif text-4xl font-light text-ivory">Rewards are currently unavailable</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-ivory-muted">
          We are preparing the referral program. No referral reward is promised while the program is paused.
        </p>
        <Link href="/collections/all" className="mt-7 inline-flex border border-wine-700 px-6 py-3 text-xs font-medium uppercase tracking-widest text-ivory transition hover:border-ivory">
          Continue Shopping
        </Link>
      </div>
    );
  }

  if (user === 'loading') return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      {/* Header */}
      <div className="mb-12 text-center">
        <Users size={32} className="mx-auto mb-4 text-gold-400/60" />
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Share Self Love</p>
        <h1 className="font-serif text-4xl font-light text-ivory">Refer a Friend</h1>
        <p className="mt-3 text-sm leading-relaxed text-ivory-muted">
          Your friend gets <strong className="text-ivory">${rewardSettings.amount.toFixed(0)} off their first order</strong>
          {rewardSettings.minimumSubtotal > 0 ? ` of $${rewardSettings.minimumSubtotal.toFixed(0)} or more` : ''}
          when they join with your link. When they place that order, you get a{' '}
          <strong className="text-ivory">${rewardSettings.amount.toFixed(0)} code</strong> too.
        </p>
      </div>

      {error && <p role="status" className="mb-6 text-center text-sm text-ivory-muted">{error}</p>}
      {referral && !referral.rewardsEnabled && <p role="status" className="mb-6 text-center text-sm text-ivory-muted">Reward delivery is temporarily paused. Your referral link remains available.</p>}
      {/* How it works */}
      <div className="mb-12 grid gap-px bg-gold-600/10 sm:grid-cols-3">
        {[
          { step: '01', title: 'Share', desc: 'Send your private referral link to a friend you trust.' },
          { step: '02', title: 'They join', desc: `After email and account verification, your friend can receive a personal $${rewardSettings.amount.toFixed(0)} code.` },
          { step: '03', title: 'You earn', desc: `After their first payment is verified, you can receive your own personal $${rewardSettings.amount.toFixed(0)} code.` },
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
              <p className="mt-1 text-xs uppercase tracking-widest text-ivory-dim">Rewards Earned</p>
            </div>
          </div>

          {/* Reward codes */}
          <div className="border border-gold-600/25 bg-wine-900 p-6">
            <p className="mb-3 text-xs font-medium uppercase tracking-widest text-ivory-muted">Your Reward Codes</p>
            {referral.rewards.length === 0 ? (
              <p className="text-xs text-ivory-dim">No reward codes yet. Codes are personal and cannot be transferred.</p>
            ) : (
              <ul className="space-y-2">
                {referral.rewards.map((reward) => (
                  <li key={reward.code} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-ivory-muted">
                      ${Number(reward.amount).toFixed(2)} off{Number(reward.minimum_subtotal) > 0 ? ` orders of $${Number(reward.minimum_subtotal).toFixed(0)}+` : ''}
                      {' · '}{reward.kind === 'welcome' ? 'welcome gift' : 'thank-you'}
                    </span>
                    {reward.status === 'issued' ? (
                      <span className="font-mono text-gold-400">{reward.code}</span>
                    ) : (
                      <span className="text-ivory-dim">Being prepared…</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-center text-xs text-ivory-dim">
            Codes are emailed to you, can be used once at checkout, and do not expire.
          </p>
        </div>
      ) : null}
    </div>
  );
}
