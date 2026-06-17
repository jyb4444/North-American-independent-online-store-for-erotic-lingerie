'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { track } from '@/lib/analytics';

const COOKIE_KEY = 'velour_age_verified';
const COOKIE_DAYS = 30;

function getAgeCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => c.trim().startsWith(`${COOKIE_KEY}=1`));
}

function setAgeCookie() {
  const expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
  // SameSite=Strict prevents CSRF; Secure added in production via HSTS
  document.cookie = `${COOKIE_KEY}=1; expires=${expires}; path=/; SameSite=Strict`;
}

export default function AgeGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!getAgeCookie()) setShow(true);
  }, []);

  function handleConfirm() {
    setAgeCookie();
    track.ageGatePassed();
    setShow(false);
  }

  function handleDeny() {
    track.ageGateDenied();
    window.location.href = 'https://www.google.com';
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-wine-950/95 backdrop-blur-md"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-0 h-px w-48 -translate-x-1/2 bg-gradient-to-r from-transparent via-gold-400/40 to-transparent" />
            <div className="absolute bottom-0 left-1/2 h-px w-48 -translate-x-1/2 bg-gradient-to-r from-transparent via-gold-400/40 to-transparent" />
          </div>

          <motion.div
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="relative mx-4 max-w-sm rounded-none border border-gold-600/30 bg-wine-900 p-10 text-center shadow-2xl"
          >
            <span className="absolute left-4 top-4 font-serif text-lg text-gold-600/40 select-none">✦</span>
            <span className="absolute right-4 top-4 font-serif text-lg text-gold-600/40 select-none">✦</span>

            <p className="mb-1 font-serif text-xs font-light uppercase tracking-[0.3em] text-gold-400">Velour</p>
            <h1 className="mb-1 font-serif text-3xl font-light italic text-ivory">Adults Only</h1>
            <div className="mx-auto mb-6 h-px w-12 bg-gold-400/50" />
            <p className="mb-8 text-sm leading-relaxed text-ivory-muted">
              This boutique contains adult content for individuals{' '}
              <span className="text-gold-400">18 years or older</span>.
              By entering, you confirm your age.
            </p>

            <div className="flex flex-col gap-3">
              <button onClick={handleConfirm}
                className="w-full border border-gold-400 bg-transparent py-3 text-xs font-medium uppercase tracking-[0.2em] text-gold-400 transition hover:bg-gold-400 hover:text-wine-950">
                I am 18 or older — Enter
              </button>
              <button onClick={handleDeny}
                className="w-full py-2 text-xs text-ivory-dim transition hover:text-ivory-muted">
                I am under 18 — Exit
              </button>
            </div>
            <p className="mt-4 text-xs text-ivory-dim">
              Verification is remembered for {COOKIE_DAYS} days.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
