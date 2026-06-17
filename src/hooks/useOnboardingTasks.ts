'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAiLookbook } from '@/hooks/useAiLookbook';
import { useFitProfile } from '@/hooks/useFitProfile';
import { useWishlistSummary } from '@/hooks/useWishlistSummary';
import { track } from '@/lib/analytics';

export const ONBOARDING_STORAGE_KEY = 'velour_onboarding_tasks_v1';
export const AI_PREVIEW_TRIED_STORAGE_KEY = 'velour_ai_preview_tried_v1';
const ONBOARDING_CHANGED_EVENT = 'velour_onboarding_tasks_changed';

export type OnboardingTaskId =
  | 'account_created'
  | 'fit_profile_saved'
  | 'first_item_saved'
  | 'ai_preview_tried'
  | 'ai_look_saved';

type StoredOnboardingState = {
  completed: Partial<Record<OnboardingTaskId, boolean>>;
  dismissed: boolean;
};

export type OnboardingTask = {
  id: OnboardingTaskId;
  label: string;
  description: string;
  completed: boolean;
};

const TASK_COPY: Record<OnboardingTaskId, Pick<OnboardingTask, 'label' | 'description'>> = {
  account_created: {
    label: 'Create your private account',
    description: 'Keep saved styles and preferences in one discreet place.',
  },
  fit_profile_saved: {
    label: 'Save your fit profile',
    description: 'Personalize size guidance without sharing measurements publicly.',
  },
  first_item_saved: {
    label: 'Save a style for later',
    description: 'Build a private wishlist only you can see.',
  },
  ai_preview_tried: {
    label: 'Try AI fit preview',
    description: 'See a private style preview before deciding.',
  },
  ai_look_saved: {
    label: 'Save your first AI look',
    description: 'Keep a browser-only reference for styles you like.',
  },
};

function getStoredOnboardingSnapshot(): string {
  if (typeof window === 'undefined') return '{"completed":{},"dismissed":false}';
  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) ?? '{"completed":{},"dismissed":false}';
  } catch {
    return '{"completed":{},"dismissed":false}';
  }
}

function parseStoredState(raw: string): StoredOnboardingState {
  try {
    const parsed = JSON.parse(raw) as StoredOnboardingState;
    return {
      completed: parsed.completed ?? {},
      dismissed: !!parsed.dismissed,
    };
  } catch {
    return { completed: {}, dismissed: false };
  }
}

function writeStoredState(next: StoredOnboardingState) {
  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(ONBOARDING_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

function getAiPreviewTriedSnapshot(): string {
  if (typeof window === 'undefined') return '0';
  try {
    return window.localStorage.getItem(AI_PREVIEW_TRIED_STORAGE_KEY) ?? '0';
  } catch {
    return '0';
  }
}

export function markAiPreviewTried() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AI_PREVIEW_TRIED_STORAGE_KEY, '1');
    window.dispatchEvent(new Event(ONBOARDING_CHANGED_EVENT));
  } catch {
    // Ignore local persistence failures in restricted browser modes.
  }
}

export function useOnboardingTasks() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { hasProfile } = useFitProfile();
  const wishlist = useWishlistSummary(1);
  const { looks } = useAiLookbook();

  const rawStoredState = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('storage', onStoreChange);
      window.addEventListener(ONBOARDING_CHANGED_EVENT, onStoreChange);
      return () => {
        window.removeEventListener('storage', onStoreChange);
        window.removeEventListener(ONBOARDING_CHANGED_EVENT, onStoreChange);
      };
    },
    getStoredOnboardingSnapshot,
    () => '{"completed":{},"dismissed":false}'
  );

  const aiPreviewTried = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('storage', onStoreChange);
      window.addEventListener(ONBOARDING_CHANGED_EVENT, onStoreChange);
      return () => {
        window.removeEventListener('storage', onStoreChange);
        window.removeEventListener(ONBOARDING_CHANGED_EVENT, onStoreChange);
      };
    },
    getAiPreviewTriedSnapshot,
    () => '0'
  ) === '1';

  const storedState = useMemo(() => parseStoredState(rawStoredState), [rawStoredState]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setIsAuthenticated(!!data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthenticated(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  const tasks = useMemo(() => {
    const derivedCompleted: Partial<Record<OnboardingTaskId, boolean>> = {
      account_created: isAuthenticated,
      fit_profile_saved: hasProfile,
      first_item_saved: wishlist.count > 0,
      ai_preview_tried: aiPreviewTried,
      ai_look_saved: looks.length > 0,
    };

    return (Object.keys(TASK_COPY) as OnboardingTaskId[]).map((id) => ({
      id,
      label: TASK_COPY[id].label,
      description: TASK_COPY[id].description,
      completed: !!derivedCompleted[id],
    }));
  }, [aiPreviewTried, hasProfile, isAuthenticated, looks.length, wishlist.count]);

  const completedCount = tasks.filter((task) => task.completed).length;
  const totalCount = tasks.length;
  const allCompleted = completedCount === totalCount;

  const markTaskCompleted = useCallback((taskId: OnboardingTaskId, source = 'action') => {
    const current = parseStoredState(getStoredOnboardingSnapshot());
    if (current.completed[taskId]) return;

    const next = {
      ...current,
      completed: { ...current.completed, [taskId]: true },
    };
    if (!writeStoredState(next)) return;
    const nextCompletedCount = Math.min(totalCount, completedCount + 1);
    track.onboardingTaskCompleted({
      task_id: taskId,
      completed_count: nextCompletedCount,
      total_count: totalCount,
      source,
    });
    if (nextCompletedCount === totalCount) {
      track.onboardingChecklistCompleted({ completed_count: nextCompletedCount, total_count: totalCount, source });
    }
  }, [completedCount, totalCount]);

  const dismissChecklist = useCallback((source = 'checklist') => {
    const current = parseStoredState(getStoredOnboardingSnapshot());
    if (!writeStoredState({ ...current, dismissed: true })) return;
    track.onboardingChecklistDismissed({ completed_count: completedCount, total_count: totalCount, source });
  }, [completedCount, totalCount]);

  const resetChecklist = useCallback(() => {
    try {
      window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      window.localStorage.removeItem(AI_PREVIEW_TRIED_STORAGE_KEY);
      window.dispatchEvent(new Event(ONBOARDING_CHANGED_EVENT));
    } catch {
      // Ignore local persistence failures in restricted browser modes.
    }
  }, []);

  return {
    tasks,
    completedCount,
    totalCount,
    allCompleted,
    dismissed: storedState.dismissed,
    markTaskCompleted,
    dismissChecklist,
    resetChecklist,
    wishlistLoading: wishlist.loading,
  };
}
