'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { initAnalytics, track } from '@/lib/analytics';
import { getCookieConsent } from '@/components/layout/CookieConsent';

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const initialized = useRef(false);

  function tryInit() {
    if (initialized.current) return;
    if (getCookieConsent() !== 'granted') return;
    initialized.current = true;
    initAnalytics();
  }

  useEffect(() => {
    tryInit();

    function onConsent(e: Event) {
      const ce = e as CustomEvent<{ value: string }>;
      if (ce.detail?.value === 'granted') tryInit();
    }

    window.addEventListener('velour:consent', onConsent);
    return () => window.removeEventListener('velour:consent', onConsent);
  }, []);

  useEffect(() => {
    if (!initialized.current) return;
    track.pageView(pathname);
  }, [pathname]);

  return <>{children}</>;
}
