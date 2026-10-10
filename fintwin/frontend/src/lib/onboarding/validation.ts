/**
 * Per-step validation for the onboarding questionnaire.
 *
 * Each step must pass before Continue moves on, and the review screen runs
 * every step again — answers saved days ago can go stale (a payday that has
 * since passed), and the review must catch that before a profile is created.
 *
 * `today` is the user's local calendar day, passed in so the rules are
 * deterministic under test.
 */

import { MAX_AMOUNT_CENTS } from "@/lib/constants";
import { addDays } from "@/lib/dates";
import { staleBillErrors } from "@/lib/onboarding/bills";
import type { OnboardingDraft, PayFrequency } from "@/types/profile";

/** Field key → message. Keys match the `id`s of the inputs they describe. */
export type FieldErrors = Partial<Record<string, string>>;

export const ONBOARDING_STEPS = [
  { title: "Income & balance", short: "Income" },
  { title: "Housing & bills", short: "Bills" },
  { title: "Everyday spending", short: "Spending" },
  { title: "Financial safety", short: "Safety" },
] as const;

export const LAST_STEP = ONBOARDING_STEPS.length - 1;

/** Schedules regular enough to anchor on a payday the user enters. */
export const SCHEDULED_PAY_FREQUENCIES = ["weekly", "biweekly", "monthly"] as const;

/** For a paycheck every N days, the next payday is at most N days away. */
const PAY_CYCLE_DAYS: Record<(typeof SCHEDULED_PAY_FREQUENCIES)[number], number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 31,
};

export const EXPECTED_PAYMENT_MAX_DAYS = 365;

export function isScheduledPayFrequency(
  frequency: PayFrequency | null,
): frequency is (typeof SCHEDULED_PAY_FREQUENCIES)[number] {
  return (
    frequency === "weekly" || frequency === "biweekly" || frequency === "monthly"
  );
}

/** Whether the paycheck amount question applies to this schedule. */
export function requiresPaycheckAmount(frequency: PayFrequency | null): boolean {
  return frequency !== "none" && frequency !== "irregular";
}

function validateIncomeStep(draft: OnboardingDraft, today: string): FieldErrors {
  const errors: FieldErrors = {};
  const frequency = draft.payFrequency;

  if (draft.balanceCents === null) {
    errors.balance = "Enter your current checking balance. If it’s empty, enter 0.";
  }

  if (!frequency) {
    errors.payFrequency = "Choose how often you’re paid.";
  }

  if (requiresPaycheckAmount(frequency)) {
    if (draft.paycheckAmountCents === null) {
      errors.paycheckAmount = "Enter your take-home pay per paycheck.";
    } else if (draft.paycheckAmountCents === 0) {
      errors.paycheckAmount =
        "A $0 paycheck can’t repeat on a schedule. Enter your take-home pay, or choose “No regular income”.";
    }
  } else if (frequency === "none" && (draft.paycheckAmountCents ?? 0) > 0) {
    errors.paycheckAmount =
      "You chose “No regular income”, so set this to $0 or choose a pay schedule.";
  }

  if (isScheduledPayFrequency(frequency)) {
    const maxDays = PAY_CYCLE_DAYS[frequency];

    if (!draft.nextPayday) {
      errors.nextPayday = "Choose the date of your next paycheck.";
    } else if (draft.nextPayday <= today) {
      errors.nextPayday =
        "Choose a date after today. Pay that arrived today should already be in your balance.";
    } else if (draft.nextPayday > addDays(today, maxDays)) {
      errors.nextPayday = `With this schedule, your next payday should be within ${maxDays} days.`;
    }
  }

  if (frequency === "semimonthly") {
    const [first, second] = draft.semimonthlyPaydays;

    if (first === null || second === null) {
      errors.semimonthlyPaydays = "Choose both paydays.";
    } else if (first === second) {
      errors.semimonthlyPaydays = "Choose two different days.";
    }
  }

  if (frequency === "irregular") {
    const stale = draft.expectedPayments.filter((payment) => payment.date <= today);

    if (stale.length > 0) {
      errors.expectedPayments =
        "Some expected payments are dated today or earlier. Remove them or add new ones.";
    }
  }

  return errors;
}

function validateHousingStep(draft: OnboardingDraft, today: string): FieldErrors {
  const errors: FieldErrors = {};

  if (!draft.noHousingPayment) {
    if (draft.housingAmountCents === null) {
      errors.housingAmount =
        "Enter your monthly rent or mortgage, or choose “I don’t pay rent or mortgage”.";
    } else if (draft.housingAmountCents === 0) {
      errors.housingAmount =
        "Enter an amount above $0, or choose “I don’t pay rent or mortgage”.";
    }

    if ((draft.housingAmountCents ?? 0) > 0 && draft.housingDueDay === null) {
      errors.housingDueDay = "Choose the day of the month it’s due.";
    }
  }

  const stale = staleBillErrors(draft.bills, today);

  if (stale) errors.bills = stale;

  return errors;
}

function validateSafetyStep(draft: OnboardingDraft): FieldErrors {
  const errors: FieldErrors = {};

  if (draft.protectedMinimumCents === null) {
    errors.protectedMinimum = "Choose or enter the balance you want to protect. It can be $0.";
  } else if (draft.protectedMinimumCents > MAX_AMOUNT_CENTS) {
    errors.protectedMinimum = "Enter a smaller amount.";
  }

  return errors;
}

export function validateStep(
  draft: OnboardingDraft,
  step: number,
  today: string,
): FieldErrors {
  switch (step) {
    case 0:
      return validateIncomeStep(draft, today);
    case 1:
      return validateHousingStep(draft, today);
    case 2:
      // Blank spending fields count as $0 and the inputs only accept valid
      // amounts, so there is nothing that can be wrong here.
      return {};
    case 3:
      return validateSafetyStep(draft);
    default:
      return {};
  }
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Errors for every step, indexed by step. */
export function validateDraft(draft: OnboardingDraft, today: string): FieldErrors[] {
  return ONBOARDING_STEPS.map((_, step) => validateStep(draft, step, today));
}

/** The first step with a problem, or `null` when the whole draft is valid. */
export function firstInvalidStep(draft: OnboardingDraft, today: string): number | null {
  const index = validateDraft(draft, today).findIndex(hasErrors);

  return index === -1 ? null : index;
}
