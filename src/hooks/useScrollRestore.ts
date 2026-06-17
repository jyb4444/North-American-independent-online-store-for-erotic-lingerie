'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const STORAGE_PREFIX = 'velour_scroll_';

export function useScrollRestore(key: string) {
  const pathname = usePathname();
  const savedRef = useRef<number | null>(null);

  // On mount: restore saved scroll position
  useEffect(() => {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      const y = Number(saved);
      // Small delay to let the DOM render before scrolling
      const id = window.setTimeout(() => { window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior }); }, 50);
      sessionStorage.removeItem(storageKey);
      return () => window.clearTimeout(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save scroll on unload (navigating away)
  useEffect(() => {
    function save() {
      const storageKey = `${STORAGE_PREFIX}${key}`;
      sessionStorage.setItem(storageKey, String(window.scrollY));
    }
    window.addEventListener('beforeunload', save);
    return () => window.removeEventListener('beforeunload', save);
  }, [key]);

  // Save when navigating within Next.js (clicking a product link)
  // Call this from click handlers on product cards
  function savePosition() {
    const storageKey = `${STORAGE_PREFIX}${key}`;
    savedRef.current = window.scrollY;
    sessionStorage.setItem(storageKey, String(window.scrollY));
  }

  return { savePosition };
}
