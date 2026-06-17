'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff } from 'lucide-react';

type Mode = 'signin' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const supabase = createClient();

  useEffect(() => {
    const id = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'signup') setMode('signup');
      // Auto-fill referral code from URL (?ref=CODE)
      const ref = params.get('ref');
      if (ref) { setReferralCode(ref.toUpperCase()); setMode('signup'); }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      router.push('/account');
      router.refresh();
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            first_free_offer_reserved: new URLSearchParams(window.location.search).get('offer') === 'first-free',
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) { setError(error.message); setLoading(false); return; }

      // Apply referral code if provided
      if (referralCode.trim()) {
        await fetch('/api/referral', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: referralCode.trim() }),
        }).catch(() => {}); // Non-blocking — don't fail signup on referral error
      }

      setSuccess('Check your email to confirm your account, then sign in.');
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      {/* Decorative lines */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-px w-64 -translate-x-1/2 bg-gradient-to-r from-transparent via-gold-400/30 to-transparent" />
        <div className="absolute bottom-0 left-1/2 h-px w-64 -translate-x-1/2 bg-gradient-to-r from-transparent via-gold-400/30 to-transparent" />
      </div>

      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <p className="font-serif text-3xl font-light italic text-gold-400">Velour</p>
          <div className="mx-auto mt-3 h-px w-10 bg-gold-600/50" />
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.3em] text-ivory-muted">
            {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
          </p>
        </div>

        <div className="border border-gold-600/30 bg-wine-900 p-8">
          {/* Corner ornaments */}
          <span className="pointer-events-none absolute left-[calc(50%-9rem)] font-serif text-base text-gold-600/25 select-none">✦</span>

          {/* Mode toggle */}
          <div className="mb-7 flex border border-wine-700">
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setSuccess(''); }}
                className={`flex-1 py-2.5 text-xs font-medium uppercase tracking-widest transition ${
                  mode === m
                    ? 'bg-gold-400 text-wine-950'
                    : 'text-ivory-muted hover:text-gold-400'
                }`}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name fields (signup only) */}
            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 text-sm text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 text-sm text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
                    placeholder="Doe"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 text-sm text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
                placeholder="jane@example.com"
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 pr-10 text-sm text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ivory-dim hover:text-gold-400 transition"
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Referral code (signup only) */}
            {mode === 'signup' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
                  Referral Code <span className="text-ivory-dim">(optional)</span>
                </label>
                <input
                  type="text"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  maxLength={19}
                  placeholder="VLR-XXXXXX-XXXX"
                  className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 font-mono text-sm text-ivory placeholder-ivory-dim/50 focus:border-gold-400 focus:outline-none transition"
                />
                <p className="mt-1 text-[11px] text-ivory-dim">
                  Have a friend&rsquo;s code? You&rsquo;ll both receive $10 store credit.
                </p>
              </div>
            )}

            {/* Error / Success */}
            {error && (
              <p className="text-xs text-crimson-400 border border-crimson-400/30 bg-crimson-700/10 px-3 py-2">
                {error}
              </p>
            )}
            {success && (
              <p className="text-xs text-green-400 border border-green-600/30 bg-green-900/20 px-3 py-2">
                {success}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full border border-gold-400 py-3 text-xs font-medium uppercase tracking-[0.2em] text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gold-600/20" />
            <span className="text-xs text-ivory-dim">or</span>
            <div className="h-px flex-1 bg-gold-600/20" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            className="flex w-full items-center justify-center gap-3 border border-wine-700 py-3 text-xs font-medium uppercase tracking-widest text-ivory-muted transition hover:border-gold-600/50 hover:text-gold-400"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
