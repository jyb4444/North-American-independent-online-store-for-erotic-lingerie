'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Gift, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const FIRST_FREE_STORAGE_KEY = 'velour_first_free_offer_v1';

type StoredOfferState = {
  dismissedAt?: string;
  reservedAt?: string;
};

function readOfferState(): StoredOfferState {
  try {
    const raw = window.localStorage.getItem(FIRST_FREE_STORAGE_KEY);
    return raw ? JSON.parse(raw) as StoredOfferState : {};
  } catch {
    return {};
  }
}

function writeOfferState(next: StoredOfferState) {
  try {
    window.localStorage.setItem(FIRST_FREE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore restricted browser storage.
  }
}

export default function FirstFreeSignupModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) return;

      const stored = readOfferState();
      if (stored.dismissedAt || stored.reservedAt) return;
      setOpen(true);
    }, 900);

    return () => window.clearTimeout(id);
  }, []);

  function dismiss() {
    writeOfferState({ ...readOfferState(), dismissedAt: new Date().toISOString() });
    setOpen(false);
  }

  function reserve() {
    writeOfferState({ ...readOfferState(), reservedAt: new Date().toISOString() });
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-wine-950/75 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md border border-gold-600/30 bg-wine-900 px-6 py-6 shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-4 top-4 text-ivory-dim transition hover:text-gold-400"
          aria-label="Close first free offer"
        >
          <X size={17} />
        </button>

        <div className="mb-4 flex h-11 w-11 items-center justify-center border border-gold-600/30 text-gold-400">
          <Gift size={18} />
        </div>
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-gold-400">First Free</p>
        <h2 className="mt-2 font-serif text-3xl font-light text-ivory">Your first style is free</h2>
        <p className="mt-3 text-sm leading-relaxed text-ivory-muted">
          Create an account to reserve one eligible first style. You only pay the shipping fee when ordering opens.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ivory-dim">
          This offer is tracked for this browser and reserved on your account after signup.
        </p>

        <div className="mt-6 grid gap-3">
          <Link
            href="/login?mode=signup&offer=first-free"
            onClick={reserve}
            className="flex items-center justify-center border border-gold-400 py-3 text-xs font-medium uppercase tracking-[0.2em] text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
          >
            Sign up and reserve
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="py-2 text-xs uppercase tracking-widest text-ivory-dim transition hover:text-ivory-muted"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
