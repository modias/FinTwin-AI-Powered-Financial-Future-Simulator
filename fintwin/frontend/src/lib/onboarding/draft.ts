/**
 * Onboarding drafts: creating them, loading a saved profile into one, and
 * turning a finished draft into a validated `FinancialProfile`.
 */

import { financialProfileSchema } from "@/lib/profile/schemas";
import {
  firstInvalidStep,
  isScheduledPayFrequency,
} from "@/lib/onboarding/validation";
import {
  VARIABLE_SPENDING_CATEGORIES,
  type FinancialProfile,
  type OnboardingDraft,
  type ProfileIncome,
  type VariableSpendingCategory,
} from "@/types/profile";

export const DEFAULT_PROTECTED_MINIMUM_CENTS = 30_000;
export const PROTECTED_MINIMUM_PRESETS_CENTS = [10_000, 30_000, 50_000] as const;

/** A random id for client-created records. Not security sensitive. */
export function createId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);

  return `${prefix}_${random}`;
}

function emptySpending(): Record<VariableSpendingCategory, number | null> {
  return Object.fromEntries(
    VARIABLE_SPENDING_CATEGORIES.map((category) => [category, null]),
  ) as Record<VariableSpendingCategory, number | null>;
}

export function createEmptyDraft(): OnboardingDraft {
  return {
    schemaVersion: 1,
    step: 0,
    basedOn: "blank",
    reviewed: false,
    balanceCents: null,
    paycheckAmountCents: null,
    payFrequency: null,
    nextPayday: null,
    semimonthlyPaydays: [null, null],
    expectedPayments: [],
    noHousingPayment: false,
    housingAmountCents: null,
    housingDueDay: null,
    bills: [],
    spendingPeriod: "monthly",
    spendingCents: emptySpending(),
    // Including unexpected costs is the cautious choice; the screen explains
    // the assumption and the user can turn it off.
    emergenciesEnabled: true,
    protectedMinimumCents: DEFAULT_PROTECTED_MINIMUM_CENTS,
    targetConfidence: 0.95,
    horizonDays: 90,
  };
}

/** Loads a saved profile into the questionnaire for editing. */
export function draftFromProfile(profile: FinancialProfile): OnboardingDraft {
  const { income } = profile;

  return {
    ...createEmptyDraft(),
    basedOn: profile.source === "demo" ? "demo" : "personal",
    reviewed: true,
    balanceCents: profile.account.balanceCents,
    paycheckAmountCents: income.paycheckAmountCents,
    payFrequency: income.frequency,
    nextPayday: "nextPayday" in income ? income.nextPayday : null,
    semimonthlyPaydays:
      "semimonthlyPaydays" in income ? income.semimonthlyPaydays : [null, null],
    expectedPayments: "expectedPayments" in income ? income.expectedPayments : [],
    noHousingPayment: profile.housing.amountCents === 0,
    housingAmountCents:
      profile.housing.amountCents === 0 ? null : profile.housing.amountCents,
    housingDueDay: profile.housing.dueDay,
    bills: profile.recurringBills,
    spendingPeriod: profile.variableSpending.period,
    spendingCents: { ...profile.variableSpending.amountsCents },
    emergenciesEnabled: profile.emergencies.enabled,
    protectedMinimumCents: profile.preferences.protectedMinimumCents,
    targetConfidence: profile.preferences.targetConfidence,
    horizonDays: profile.preferences.horizonDays,
  };
}

function draftIncome(draft: OnboardingDraft): ProfileIncome {
  const frequency = draft.payFrequency;
  const amount = draft.paycheckAmountCents ?? 0;

  if (isScheduledPayFrequency(frequency)) {
    return {
      frequency,
      paycheckAmountCents: amount,
      nextPayday: draft.nextPayday ?? "",
    };
  }

  switch (frequency) {
    case "semimonthly": {
      const [first, second] = draft.semimonthlyPaydays as [number, number];

      return {
        frequency,
        paycheckAmountCents: amount,
        semimonthlyPaydays: first < second ? [first, second] : [second, first],
      };
    }
    case "irregular":
      return {
        frequency,
        paycheckAmountCents: amount,
        expectedPayments: [...draft.expectedPayments].sort((a, b) =>
          a.date < b.date ? -1 : 1,
        ),
      };
    default:
      return { frequency: "none", paycheckAmountCents: 0 };
  }
}

export type DraftCompletion =
  | { ok: true; profile: FinancialProfile }
  | { ok: false; step: number };

interface CompleteDraftOptions {
  /** The user's local calendar day; the balance is recorded as of this day. */
  today: string;
  /** ISO timestamp. */
  now: string;
  /** The personal profile being edited, whose id and creation time are kept. */
  existing: FinancialProfile | null;
}

/**
 * Validates every step and builds the profile. Returns the first step that
 * needs attention instead when anything is missing or stale.
 */
export function draftToProfile(
  draft: OnboardingDraft,
  { today, now, existing }: CompleteDraftOptions,
): DraftCompletion {
  const invalidStep = firstInvalidStep(draft, today);

  if (invalidStep !== null) {
    return { ok: false, step: invalidStep };
  }

  const hasHousing = !draft.noHousingPayment && (draft.housingAmountCents ?? 0) > 0;

  const profile: FinancialProfile = {
    schemaVersion: 1,
    id: existing?.id ?? createId("profile"),
    source: "user_entered",
    account: {
      balanceCents: draft.balanceCents ?? 0,
      currency: "USD",
      balanceAsOf: today,
    },
    income: draftIncome(draft),
    housing: hasHousing
      ? { amountCents: draft.housingAmountCents ?? 0, dueDay: draft.housingDueDay }
      : { amountCents: 0, dueDay: null },
    recurringBills: draft.bills,
    variableSpending: {
      period: draft.spendingPeriod,
      amountsCents: Object.fromEntries(
        VARIABLE_SPENDING_CATEGORIES.map((category) => [
          category,
          draft.spendingCents[category] ?? 0,
        ]),
      ) as Record<VariableSpendingCategory, number>,
    },
    emergencies: { enabled: draft.emergenciesEnabled },
    preferences: {
      protectedMinimumCents: draft.protectedMinimumCents ?? 0,
      targetConfidence: draft.targetConfidence,
      horizonDays: draft.horizonDays,
    },
    completedAt: existing?.completedAt ?? now,
    updatedAt: now,
  };

  // Step validation and the schema should agree; parsing makes certain that
  // nothing invalid is ever stored.
  return { ok: true, profile: financialProfileSchema.parse(profile) };
}
