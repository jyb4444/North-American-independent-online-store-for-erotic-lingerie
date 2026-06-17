'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  // Profile state
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);
      setEmail(user.email ?? '');
      setFirstName(user.user_metadata?.first_name ?? '');
      setLastName(user.user_metadata?.last_name ?? '');
    });
  }, []);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess(false);
    setProfileLoading(true);

    // Update auth metadata
    const { error: authError } = await supabase.auth.updateUser({
      data: { first_name: firstName, last_name: lastName },
    });

    if (authError) { setProfileError(authError.message); setProfileLoading(false); return; }

    // Update profiles table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('profiles')
      .update({ first_name: firstName, last_name: lastName })
      .eq('id', userId);

    setProfileSuccess(true);
    setProfileLoading(false);
    setTimeout(() => setProfileSuccess(false), 3000);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);

    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }

    setPwLoading(true);

    // Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPw,
    });

    if (signInError) { setPwError('Current password is incorrect.'); setPwLoading(false); return; }

    const { error } = await supabase.auth.updateUser({ password: newPw });

    if (error) { setPwError(error.message); setPwLoading(false); return; }

    setPwSuccess(true);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwLoading(false);
    setTimeout(() => setPwSuccess(false), 3000);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.3em] text-gold-400">Account</p>
          <h1 className="font-serif text-3xl font-light text-ivory">Edit Profile</h1>
        </div>
        <Link href="/account" className="text-xs uppercase tracking-widest text-ivory-dim transition hover:text-gold-400">
          ← Account
        </Link>
      </div>

      {/* ── Profile Info ── */}
      <section className="mb-8 border border-gold-600/20 bg-wine-900 p-6">
        <h2 className="mb-5 font-serif text-lg font-light text-ivory">Personal Information</h2>
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 text-sm text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
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
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full border border-wine-800 bg-wine-950 px-3 py-2.5 text-sm text-ivory-dim cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-ivory-dim">Email cannot be changed here</p>
          </div>

          {profileError && (
            <p className="border border-crimson-400/30 bg-crimson-700/10 px-3 py-2 text-xs text-crimson-400">{profileError}</p>
          )}

          <button
            type="submit"
            disabled={profileLoading}
            className={`flex w-full items-center justify-center gap-2 border py-3 text-xs font-medium uppercase tracking-[0.2em] transition ${
              profileSuccess
                ? 'border-green-600/50 text-green-400'
                : 'border-gold-400 text-gold-400 hover:bg-gold-400 hover:text-wine-950'
            } disabled:opacity-50`}
          >
            {profileSuccess ? <><Check size={13} /> Saved</> : profileLoading ? '...' : 'Save Changes'}
          </button>
        </form>
      </section>

      {/* ── Change Password ── */}
      <section className="border border-gold-600/20 bg-wine-900 p-6">
        <h2 className="mb-5 font-serif text-lg font-light text-ivory">Change Password</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          {[
            { label: 'Current Password', value: currentPw, setter: setCurrentPw },
            { label: 'New Password', value: newPw, setter: setNewPw },
            { label: 'Confirm New Password', value: confirmPw, setter: setConfirmPw },
          ].map(({ label, value, setter }) => (
            <div key={label}>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-ivory-muted">
                {label}
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  required
                  className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 pr-10 text-sm text-ivory focus:border-gold-400 focus:outline-none transition"
                  placeholder="••••••••"
                />
                {label === 'Current Password' && (
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ivory-dim hover:text-gold-400 transition">
                    {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                )}
              </div>
            </div>
          ))}

          {pwError && (
            <p className="border border-crimson-400/30 bg-crimson-700/10 px-3 py-2 text-xs text-crimson-400">{pwError}</p>
          )}

          <button
            type="submit"
            disabled={pwLoading}
            className={`flex w-full items-center justify-center gap-2 border py-3 text-xs font-medium uppercase tracking-[0.2em] transition ${
              pwSuccess
                ? 'border-green-600/50 text-green-400'
                : 'border-gold-400 text-gold-400 hover:bg-gold-400 hover:text-wine-950'
            } disabled:opacity-50`}
          >
            {pwSuccess ? <><Check size={13} /> Password Updated</> : pwLoading ? '...' : 'Update Password'}
          </button>
        </form>
      </section>
    </div>
  );
}
