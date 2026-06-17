'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail } from 'lucide-react';

const DISMISSED_KEY = 'velour_newsletter_dismissed';
const SUBSCRIBED_KEY = 'velour_newsletter_subscribed';
const SCROLL_THRESHOLD = 0.55; // 55% page scroll
const DELAY_MS = 35_000; // 35s as fallback

export default function NewsletterSlide() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'success'>('idle');

  useEffect(() => {
    // Never show if already dismissed or subscribed
    if (
      localStorage.getItem(DISMISSED_KEY) === '1' ||
      localStorage.getItem(SUBSCRIBED_KEY) === '1'
    ) return;

    let triggered = false;

    function trigger() {
      if (triggered) return;
      triggered = true;
      setVisible(true);
    }

    // Scroll-based trigger
    function onScroll() {
      const scrolled = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      if (scrolled >= SCROLL_THRESHOLD) trigger();
    }

    // Time-based fallback
    const timerId = window.setTimeout(trigger, DELAY_MS);

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(timerId);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    try {
      await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {}
    setState('success');
    localStorage.setItem(SUBSCRIBED_KEY, '1');
    setTimeout(() => setVisible(false), 3500);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          className="fixed bottom-20 right-4 z-50 w-80 border border-gold-600/30 bg-wine-900 p-5 shadow-2xl md:bottom-6 md:right-6"
        >
          {/* Close */}
          <button
            onClick={dismiss}
            className="absolute right-3 top-3 text-ivory-dim transition hover:text-gold-400"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>

          {state === 'success' ? (
            <div className="py-2 text-center">
              <p className="font-serif text-lg font-light text-ivory">Welcome to Velour</p>
              <p className="mt-1 text-xs text-ivory-muted">
                Your first private access email is on its way.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-start gap-3">
                <Mail size={16} className="mt-0.5 flex-shrink-0 text-gold-400" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-ivory">
                    Private Early Access
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ivory-dim">
                    New arrivals, members-only offers, and styling guides — sent discreetly.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  className="w-full border border-wine-700 bg-wine-800 px-3 py-2.5 text-xs text-ivory placeholder-ivory-dim focus:border-gold-400 focus:outline-none transition"
                />
                <button
                  type="submit"
                  disabled={state === 'sending'}
                  className="border border-gold-400 py-2.5 text-[11px] font-medium uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950 disabled:opacity-50"
                >
                  {state === 'sending' ? 'Subscribing…' : 'Subscribe'}
                </button>
              </form>

              <p className="mt-3 text-center text-[10px] text-ivory-dim">
                No spam. Unsubscribe anytime. Sent from a discreet address.
              </p>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
