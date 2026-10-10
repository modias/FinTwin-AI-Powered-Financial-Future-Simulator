/**
 * Maps between a profile's stored preferences (cents, fractional confidence)
 * and the `UserPreferences` the dashboard reads (dollars, whole percent).
 * The profile is the source of truth; the dashboard shape is derived.
 */

import { DEFAULT_PREFERENCES } from "@/lib/constants";
import { centsToDollars, dollarsToCents } from "@/lib/money";
import type {
  TargetConfidence,
  ThemePreference,
  UserPreferences,
} from "@/types/financial";
import type { ProfileConfidence, ProfilePreferences } from "@/types/profile";

const toPercent: Record<ProfileConfidence, TargetConfidence> = {
  0.9: 90,
  0.95: 95,
  0.99: 99,
};

const toFraction: Record<TargetConfidence, ProfileConfidence> = {
  90: 0.9,
  95: 0.95,
  99: 0.99,
};

export const DEFAULT_PROFILE_PREFERENCES: ProfilePreferences = {
  protectedMinimumCents: dollarsToCents(DEFAULT_PREFERENCES.minimumProtectedBalance),
  targetConfidence: toFraction[DEFAULT_PREFERENCES.targetConfidence],
  horizonDays: DEFAULT_PREFERENCES.forecastHorizonDays,
};

export function toUserPreferences(
  preferences: ProfilePreferences | null,
  theme: ThemePreference,
): UserPreferences {
  if (!preferences) return { ...DEFAULT_PREFERENCES, theme };

  return {
    minimumProtectedBalance: centsToDollars(preferences.protectedMinimumCents),
    targetConfidence: toPercent[preferences.targetConfidence],
    forecastHorizonDays: preferences.horizonDays,
    theme,
  };
}

export function toProfilePreferencesPatch(
  patch: Partial<UserPreferences>,
): Partial<ProfilePreferences> {
  const result: Partial<ProfilePreferences> = {};

  if (patch.minimumProtectedBalance !== undefined) {
    result.protectedMinimumCents = dollarsToCents(patch.minimumProtectedBalance);
  }
  if (patch.targetConfidence !== undefined) {
    result.targetConfidence = toFraction[patch.targetConfidence];
  }
  if (patch.forecastHorizonDays !== undefined) {
    result.horizonDays = patch.forecastHorizonDays;
  }

  return result;
}
