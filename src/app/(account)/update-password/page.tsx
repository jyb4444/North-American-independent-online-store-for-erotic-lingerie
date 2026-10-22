'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    const response = await fetch('/api/account/recover-password', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
    const body = await response.json().catch(()=>({})) as {error?:string};
    setBusy(false);
    if (!response.ok) return setError(body.error ?? 'Unable to update password.');
    router.replace('/account/profile?password=updated'); router.refresh();
  }
  return <main className="mx-auto max-w-md px-4 py-20">
    <p className="text-xs uppercase tracking-[0.3em] text-gold-400">Account recovery</p>
    <h1 className="mt-2 font-serif text-3xl">Choose a new password</h1>
    <form onSubmit={submit} className="mt-8 space-y-4">
      <label className="block text-xs uppercase tracking-widest">New password<input aria-label="New password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full border border-wine-700 bg-wine-800 px-3 py-3 text-sm" /></label>
      <label className="block text-xs uppercase tracking-widest">Confirm new password<input aria-label="Confirm new password" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-2 w-full border border-wine-700 bg-wine-800 px-3 py-3 text-sm" /></label>
      {error && <p className="text-sm text-crimson-400">{error}</p>}
      <button disabled={busy} className="w-full border border-gold-400 py-3 text-xs uppercase tracking-widest text-gold-400 disabled:opacity-50">{busy ? 'Updating…' : 'Update password'}</button>
    </form>
  </main>;
}
