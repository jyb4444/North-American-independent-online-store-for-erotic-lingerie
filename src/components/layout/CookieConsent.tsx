'use client';

import { useEffect, useState } from 'react';
import { X, Cookie } from 'lucide-react';

export const COOKIE_CONSENT_KEY = 'velour_cookie_consent_v1';
export type ConsentValue = 'granted' | 'denied';

export function getCookieConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(COOKIE_CONSENT_KEY);
  return v === 'granted' || v === 'denied' ? v : null;
}

export function setCookieConsent(value: ConsentValue) {
  window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  window.dispatchEvent(new CustomEvent('velour:consent', { detail: { value } }));
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const existing = getCookieConsent();
    if (!existing) {
      const t = window.setTimeout(() => setVisible(true), 1200);
      return () => window.clearTimeout(t);
    }
  }, []);

  function accept() {
    setCookieConsent('granted');
    setVisible(false);
  }

  function decline() {
    setCookieConsent('denied');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gold-600/20 bg-wine-900 shadow-2xl"
    >
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Cookie size={15} className="mt-0.5 flex-shrink-0 text-gold-400" />
            <div className="min-w-0">
              <p className="text-xs text-ivory-muted leading-relaxed">
                We use essential cookies to keep your session, and optional analytics cookies to improve the experience.
                We never share personal data or track sensitive activity.{' '}
                <a href="/pages/privacy" className="text-gold-400 hover:underline">Privacy Policy</a>
              </p>
              {expanded && (
                <div className="mt-3 space-y-2 border-t border-gold-600/10 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ivory-muted"><strong className="text-ivory">Essential</strong> — session, cart, preferences</span>
                    <span className="text-ivory-dim">Always on</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ivory-muted"><strong className="text-ivory">Analytics</strong> — anonymised page views and feature usage (PostHog). No measurements or personal data.</span>
                    <span className="text-ivory-dim">Optional</span>
                  </div>
                </div>
              )}
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 text-[11px] text-ivory-dim underline underline-offset-2 hover:text-gold-400 transition"
              >
                {expanded ? 'Hide details' : 'Manage preferences'}
              </button>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              onClick={decline}
              className="border border-wine-700 px-4 py-2 text-[11px] uppercase tracking-widest text-ivory-dim transition hover:border-gold-400/40 hover:text-ivory-muted"
            >
              Decline
            </button>
            <button
              onClick={accept}
              className="border border-gold-400 px-4 py-2 text-[11px] uppercase tracking-widest text-gold-400 transition hover:bg-gold-400 hover:text-wine-950"
            >
              Accept
            </button>
            <button onClick={decline} aria-label="Close" className="ml-1 text-ivory-dim hover:text-gold-400 transition">
              <X size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
