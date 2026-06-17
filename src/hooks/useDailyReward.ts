'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAiLookbook } from '@/hooks/useAiLookbook';
import { useFitProfile } from '@/hooks/useFitProfile';
import { useWishlistSummary } from '@/hooks/useWishlistSummary';
import { track } from '@/lib/analytics';

export const DAILY_REWARD_STORAGE_KEY = 'velour_daily_reward_ui_v1';
const DAILY_REWARD_CHANGED_EVENT = 'velour_daily_reward_changed';

export type DailyRewardType =
  | 'style_tip'
  | 'fit_tip'
  | 'private_perk'
  | 'ai_preview_prompt'
  | 'wishlist_prompt';

export type DailyReward = {
  id: string;
  type: DailyRewardType;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  openedAt: string;
};

type DailyRewardState = {
  lastOpenedDate: string;
  lastDismissedDate?: string;
  openedRewards: DailyReward[];
};

type DailyRewardSource = 'home' | 'account' | 'membership';
type CountBucket = '0' | '1-3' | '4+';

const EMPTY_STATE: DailyRewardState = {
  lastOpenedDate: '',
  openedRewards: [],
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getSnapshot(): string {
  if (typeof window === 'undefined') return JSON.stringify(EMPTY_STATE);
  try {
    return window.localStorage.getItem(DAILY_REWARD_STORAGE_KEY) ?? JSON.stringify(EMPTY_STATE);
  } catch {
    return JSON.stringify(EMPTY_STATE);
  }
}

function parseState(raw: string): DailyRewardState {
  try {
    const parsed = JSON.parse(raw) as DailyRewardState;
    return {
      lastOpenedDate: parsed.lastOpenedDate ?? '',
      lastDismissedDate: parsed.lastDismissedDate,
      openedRewards: Array.isArray(parsed.openedRewards) ? parsed.openedRewards : [],
    };
  } catch {
    return EMPTY_STATE;
  }
}

function writeState(next: DailyRewardState) {
  try {
    window.localStorage.setItem(DAILY_REWARD_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(DAILY_REWARD_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

function bucketCount(count: number): CountBucket {
  if (count <= 0) return '0';
  if (count <= 3) return '1-3';
  return '4+';
}

function createReward(type: DailyRewardType, date: string): DailyReward {
  const base = { id: `${date}-${type}`, type, openedAt: '' };

  if (type === 'fit_tip') {
    return {
      ...base,
      title: "Today's fit guidance",
      description: 'Between sizes? Choose the softer fit for comfort, or the closer fit for a sculpted look.',
      ctaLabel: 'Try Fit Advisor',
      ctaHref: '/products/lace-halter-babydoll-set',
    };
  }

  if (type === 'wishlist_prompt') {
    return {
      ...base,
      title: 'Come back to your saved styles',
      description: 'Use your private wishlist to compare styles without pressure.',
      ctaLabel: 'View saved styles',
      ctaHref: '/account/wishlist',
    };
  }

  if (type === 'ai_preview_prompt') {
    return {
      ...base,
      title: 'Try a private AI preview',
      description: 'Preview a look before saving it. AI previews are not saved unless you choose.',
      ctaLabel: 'Try AI Preview',
      ctaHref: '/products/lace-halter-babydoll-set',
    };
  }

  if (type === 'private_perk') {
    return {
      ...base,
      title: 'Your private shopping reminder',
      description: 'Your saved styles stay private while you decide.',
      ctaLabel: 'Explore styles',
      ctaHref: '/',
    };
  }

  return {
    ...base,
    title: "Today's private style tip",
    description: "Adjustable straps and stretch lace are easier choices when you're exploring a new fit.",
    ctaLabel: 'Explore styles',
    ctaHref: '/',
  };
}

export function useDailyReward(source: DailyRewardSource) {
  const { hasProfile } = useFitProfile();
  const wishlist = useWishlistSummary(3);
  const { looks } = useAiLookbook();

  const rawState = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('storage', onStoreChange);
      window.addEventListener(DAILY_REWARD_CHANGED_EVENT, onStoreChange);
      return () => {
        window.removeEventListener('storage', onStoreChange);
        window.removeEventListener(DAILY_REWARD_CHANGED_EVENT, onStoreChange);
      };
    },
    getSnapshot,
    () => JSON.stringify(EMPTY_STATE)
  );

  const state = useMemo(() => parseState(rawState), [rawState]);
  const date = todayKey();
  const isDismissedToday = state.lastDismissedDate === date;
  const isRevealedToday = state.lastOpenedDate === date;
  const openedToday = state.openedRewards.find((reward) => reward.id.startsWith(`${date}-`));

  const candidateType: DailyRewardType = useMemo(() => {
    if (!hasProfile) return 'fit_tip';
    if (wishlist.count > 0) return 'wishlist_prompt';
    if (looks.length === 0) return 'ai_preview_prompt';
    return date.endsWith('0') || date.endsWith('5') ? 'private_perk' : 'style_tip';
  }, [date, hasProfile, looks.length, wishlist.count]);

  const reward = openedToday ?? createReward(candidateType, date);
  const analyticsPayload = useMemo(() => ({
    reward_type: reward.type,
    source,
    has_fit_profile: hasProfile,
    wishlist_count_bucket: bucketCount(wishlist.count),
    ai_look_count_bucket: bucketCount(looks.length),
    is_authenticated: wishlist.isAuthenticated,
  }), [hasProfile, looks.length, reward.type, source, wishlist.count, wishlist.isAuthenticated]);

  const trackViewed = useCallback(() => {
    track.dailyRewardViewed(analyticsPayload);
  }, [analyticsPayload]);

  const reveal = useCallback(() => {
    if (isRevealedToday) return reward;

    const openedReward = { ...reward, openedAt: new Date().toISOString() };
    const nextRewards = [
      openedReward,
      ...state.openedRewards.filter((item) => item.id !== openedReward.id),
    ].slice(0, 14);

    const saved = writeState({
      ...state,
      lastOpenedDate: date,
      openedRewards: nextRewards,
    });
    if (!saved) return reward;
    track.dailyRewardRevealed(analyticsPayload);
    return openedReward;
  }, [analyticsPayload, date, isRevealedToday, reward, state]);

  const dismiss = useCallback(() => {
    const saved = writeState({
      ...state,
      lastDismissedDate: date,
    });
    if (!saved) return;
    track.dailyRewardDismissed(analyticsPayload);
  }, [analyticsPayload, date, state]);

  const trackCtaClicked = useCallback(() => {
    track.dailyRewardCtaClicked(analyticsPayload);
  }, [analyticsPayload]);

  return {
    reward,
    isDismissedToday,
    isRevealedToday,
    loading: wishlist.loading,
    reveal,
    dismiss,
    trackViewed,
    trackCtaClicked,
  };
}
