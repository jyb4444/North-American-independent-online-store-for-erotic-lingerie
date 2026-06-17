'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  calculateSize,
  type BodyShape,
  type CupSize,
  type FitInput,
  type FitResult,
  type SkinTone,
} from '@/lib/fit-calculator';
import { track } from '@/lib/analytics';
import type { Product } from '@/types';

export const FIT_PROFILE_STORAGE_KEY = 'velour_fit_profile_v1';
const FIT_PROFILE_CHANGE_EVENT = 'velour_fit_profile_changed';

const CUP_SIZES: CupSize[] = ['A', 'B', 'C', 'D', 'DD+'];
const BODY_SHAPES: BodyShape[] = ['hourglass', 'pear', 'apple', 'rectangle', 'inverted-triangle'];
const SKIN_TONES: SkinTone[] = ['fair', 'light', 'medium', 'dark', 'deep'];

export type FitProfileSource = 'anonymous' | 'account';

export type FitProfile = Partial<FitInput> & {
  updatedAt: string;
  source: FitProfileSource;
};

export type FitProfileValidation = {
  valid: boolean;
  errors: Partial<Record<keyof FitInput, string>>;
};

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function hasEnumValue<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === 'string' && values.includes(value as T);
}

export function validateFitProfile(input: Partial<FitInput>): FitProfileValidation {
  const errors: FitProfileValidation['errors'] = {};

  if (!isNumberInRange(input.height, 140, 200)) errors.height = 'Height must be between 140 and 200 cm.';
  if (!isNumberInRange(input.bust, 70, 130)) errors.bust = 'Bust must be between 70 and 130 cm.';
  if (!isNumberInRange(input.waist, 55, 110)) errors.waist = 'Waist must be between 55 and 110 cm.';
  if (!isNumberInRange(input.hip, 75, 135)) errors.hip = 'Hip must be between 75 and 135 cm.';
  if (!hasEnumValue(input.cupSize, CUP_SIZES)) errors.cupSize = 'Choose a cup size.';
  if (!hasEnumValue(input.bodyShape, BODY_SHAPES)) errors.bodyShape = 'Choose a body shape.';
  if (!hasEnumValue(input.skinTone, SKIN_TONES)) errors.skinTone = 'Choose a skin tone.';

  return { valid: Object.keys(errors).length === 0, errors };
}

function toFitInput(profile: FitProfile | null): FitInput | null {
  if (!profile) return null;
  const validation = validateFitProfile(profile);
  if (!validation.valid) return null;

  return {
    height: profile.height!,
    bust: profile.bust!,
    waist: profile.waist!,
    hip: profile.hip!,
    cupSize: profile.cupSize!,
    bodyShape: profile.bodyShape!,
    skinTone: profile.skinTone!,
  };
}

function getStoredProfileSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(FIT_PROFILE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readStoredProfile(): FitProfile | null {
  const raw = getStoredProfileSnapshot();
  return parseStoredProfile(raw);
}

function parseStoredProfile(raw: string | null): FitProfile | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as FitProfile;
    return parsed && typeof parsed.updatedAt === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function countProfileFields(profile: Partial<FitInput>): number {
  return (['height', 'bust', 'waist', 'hip', 'cupSize', 'bodyShape', 'skinTone'] as const)
    .filter((key) => profile[key] !== undefined && profile[key] !== null).length;
}

function notifyProfileChanged() {
  try {
    window.dispatchEvent(new Event(FIT_PROFILE_CHANGE_EVENT));
  } catch {
    // Ignore event dispatch failures in restricted browser modes.
  }
}

export function useFitProfile() {
  const storedProfile = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('storage', onStoreChange);
      window.addEventListener(FIT_PROFILE_CHANGE_EVENT, onStoreChange);
      return () => {
        window.removeEventListener('storage', onStoreChange);
        window.removeEventListener(FIT_PROFILE_CHANGE_EVENT, onStoreChange);
      };
    },
    getStoredProfileSnapshot,
    () => null
  );
  const profile = useMemo(() => parseStoredProfile(storedProfile), [storedProfile]);
  const fitInput = useMemo(() => toFitInput(profile), [profile]);
  const hasProfile = !!fitInput;

  const saveProfile = useCallback((input: Partial<FitInput>, source: FitProfileSource = 'anonymous') => {
    const validation = validateFitProfile(input);
    if (!validation.valid) return { ok: false as const, validation };

    const existing = readStoredProfile();
    const nextProfile: FitProfile = {
      height: input.height,
      bust: input.bust,
      waist: input.waist,
      hip: input.hip,
      cupSize: input.cupSize,
      bodyShape: input.bodyShape,
      skinTone: input.skinTone,
      source,
      updatedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(FIT_PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
    } catch {
      return { ok: false as const, validation };
    }
    notifyProfileChanged();

    const payload = {
      source,
      has_profile: true,
      profile_fields_count: countProfileFields(nextProfile),
    };
    if (existing) track.fitProfileUpdated(payload);
    else track.fitProfileSaved(payload);

    return { ok: true as const, validation };
  }, []);

  const updateProfile = useCallback((input: Partial<FitInput>) => {
    const existing = readStoredProfile();
    return saveProfile({ ...(existing ?? {}), ...input }, existing?.source ?? 'anonymous');
  }, [saveProfile]);

  const clearProfile = useCallback(() => {
    try {
      window.localStorage.removeItem(FIT_PROFILE_STORAGE_KEY);
    } catch {
      return;
    }
    notifyProfileChanged();
    track.fitProfileCleared({
      source: profile?.source ?? 'anonymous',
      has_profile: false,
      profile_fields_count: 0,
    });
  }, [profile?.source]);

  const getFitResult = useCallback((product?: Product): FitResult | null => {
    void product;
    if (!fitInput) return null;
    return calculateSize(fitInput);
  }, [fitInput]);

  return {
    profile,
    fitInput,
    hasProfile,
    saveProfile,
    updateProfile,
    clearProfile,
    validateProfile: validateFitProfile,
    getFitResult,
  };
}
