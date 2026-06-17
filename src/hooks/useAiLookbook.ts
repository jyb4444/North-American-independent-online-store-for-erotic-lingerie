'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { track } from '@/lib/analytics';

export const AI_LOOKBOOK_STORAGE_KEY = 'velour_ai_lookbook_v1';
const AI_LOOKBOOK_CHANGED_EVENT = 'velour_ai_lookbook_changed';
export const AI_LOOKBOOK_MAX_LOOKS = 4;

export type AiLook = {
  id: string;
  productId?: string;
  productHandle?: string;
  imageUrl?: string;
  recommendedSize?: string;
  createdAt: string;
};

export type SaveLookInput = Omit<AiLook, 'id' | 'createdAt'>;

function getSnapshot(): string {
  if (typeof window === 'undefined') return '[]';
  try {
    return window.localStorage.getItem(AI_LOOKBOOK_STORAGE_KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

function parseLooks(raw: string): AiLook[] {
  try {
    const parsed = JSON.parse(raw) as AiLook[];
    return Array.isArray(parsed) ? parsed.filter((look) => typeof look.id === 'string') : [];
  } catch {
    return [];
  }
}

function emitLookbookChanged() {
  try {
    window.dispatchEvent(new Event(AI_LOOKBOOK_CHANGED_EVENT));
  } catch {
    // Ignore event dispatch failures in restricted browser modes.
  }
}

function createLookId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `look_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function useAiLookbook() {
  const rawLooks = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('storage', onStoreChange);
      window.addEventListener(AI_LOOKBOOK_CHANGED_EVENT, onStoreChange);
      return () => {
        window.removeEventListener('storage', onStoreChange);
        window.removeEventListener(AI_LOOKBOOK_CHANGED_EVENT, onStoreChange);
      };
    },
    getSnapshot,
    () => '[]'
  );

  const looks = useMemo(() => parseLooks(rawLooks), [rawLooks]);

  const saveLook = useCallback((input: SaveLookInput, source = 'fit_advisor') => {
    const existing = parseLooks(getSnapshot());
    const nextLook: AiLook = {
      ...input,
      id: createLookId(),
      createdAt: new Date().toISOString(),
    };
    const nextLooks = [nextLook, ...existing].slice(0, AI_LOOKBOOK_MAX_LOOKS);

    try {
      window.localStorage.setItem(AI_LOOKBOOK_STORAGE_KEY, JSON.stringify(nextLooks));
    } catch {
      return { look: null, replacedOldest: false, ok: false as const };
    }
    emitLookbookChanged();
    track.aiLookSaved({
      product_id: input.productId ?? null,
      product_handle: input.productHandle ?? null,
      has_recommended_size: !!input.recommendedSize,
      source,
      saved_count: nextLooks.length,
    });

    return { look: nextLook, replacedOldest: existing.length >= AI_LOOKBOOK_MAX_LOOKS, ok: true as const };
  }, []);

  const deleteLook = useCallback((id: string, source = 'lookbook') => {
    const existing = parseLooks(getSnapshot());
    const nextLooks = existing.filter((look) => look.id !== id);
    try {
      window.localStorage.setItem(AI_LOOKBOOK_STORAGE_KEY, JSON.stringify(nextLooks));
    } catch {
      return;
    }
    emitLookbookChanged();
    track.aiLookDeleted({ source, saved_count: nextLooks.length });
  }, []);

  const clearLooks = useCallback(() => {
    try {
      window.localStorage.removeItem(AI_LOOKBOOK_STORAGE_KEY);
    } catch {
      return;
    }
    emitLookbookChanged();
  }, []);

  const isSaved = useCallback((imageUrl?: string) => {
    if (!imageUrl) return false;
    return looks.some((look) => look.imageUrl === imageUrl);
  }, [looks]);

  const trackLookbookViewed = useCallback((source: string) => {
    track.aiLookbookViewed({ source, saved_count: looks.length });
  }, [looks.length]);

  return {
    looks,
    maxLooks: AI_LOOKBOOK_MAX_LOOKS,
    saveLook,
    deleteLook,
    clearLooks,
    isSaved,
    trackLookbookViewed,
  };
}
