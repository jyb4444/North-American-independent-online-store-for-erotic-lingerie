'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import SuccessNotice from '@/components/ui/SuccessNotice';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/update-password')}`;
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setBusy(false);
    if (error) { setError(error.message); return; }
    // The same response is shown whether or not the address exists.
    setSent(true);
  }

  return <main className="mx-auto max-w-md px-4 py-20">
    <p className="text-xs uppercase tracking-[0.3em] text-gold-400">Account recovery</p>
    <h1 className="mt-2 font-serif text-3xl">Reset your password</h1>
    <p className="mt-3 text-sm text-ivory-dim">Enter your account email. If it matches an account, we will send a secure reset link.</p>
    {sent ? <div className="mt-8"><SuccessNotice>Check your email for a password reset link.</SuccessNotice></div> :
      <form onSubmit={submit} className="mt-8 space-y-4">
        <label className="block text-xs uppercase tracking-widest">Email
          <input aria-label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full border border-wine-700 bg-wine-800 px-3 py-3 text-sm" />
        </label>
        {error && <p className="text-sm text-crimson-400">{error}</p>}
        <button disabled={busy} className="w-full border border-gold-400 py-3 text-xs uppercase tracking-widest text-gold-400 disabled:opacity-50">{busy ? 'Sending…' : 'Send reset link'}</button>
      </form>}
    <Link href="/login" className="mt-6 inline-block text-xs uppercase tracking-widest text-ivory-dim hover:text-gold-400">Back to sign in</Link>
  </main>;
}
