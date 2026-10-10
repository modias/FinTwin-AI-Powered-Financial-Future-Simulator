import { createEmptyDraft } from "@/lib/onboarding/draft";
import { financialProfileSchema } from "@/lib/profile/schemas";
import type { FinancialProfile, OnboardingDraft } from "@/types/profile";

/** A Monday. Profiles below record their balance as of this day. */
export const TODAY = "2026-10-12";
export const NOW = "2026-10-12T15:00:00.000Z";

const NO_SPENDING = {
  groceries: 0,
  transportation: 0,
  dining: 0,
  shopping: 0,
  entertainment: 0,
  personal_care: 0,
  other: 0,
};

/** A valid personal profile; parsed, so a broken fixture fails loudly. */
export function makeProfile(overrides: Partial<FinancialProfile> = {}): FinancialProfile {
  return financialProfileSchema.parse({
    schemaVersion: 1,
    id: "profile_test",
    source: "user_entered",
    account: { balanceCents: 200_000, currency: "USD", balanceAsOf: TODAY },
    income: { frequency: "biweekly", paycheckAmountCents: 150_000, nextPayday: "2026-10-16" },
    housing: { amountCents: 120_000, dueDay: 1 },
    recurringBills: [],
    variableSpending: { period: "monthly", amountsCents: NO_SPENDING },
    emergencies: { enabled: false },
    preferences: { protectedMinimumCents: 30_000, targetConfidence: 0.95, horizonDays: 90 },
    completedAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } satisfies FinancialProfile);
}

/** A draft that passes every step when `today` is `TODAY`. */
export function makeValidDraft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return {
    ...createEmptyDraft(),
    balanceCents: 200_000,
    paycheckAmountCents: 150_000,
    payFrequency: "biweekly",
    nextPayday: "2026-10-16",
    housingAmountCents: 120_000,
    housingDueDay: 1,
    ...overrides,
  };
}
