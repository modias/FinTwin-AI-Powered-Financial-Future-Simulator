/**
 * The personal financial profile collected during onboarding.
 *
 * Every monetary value is an integer number of cents, so amounts the user typed
 * are stored exactly and never accumulate float error. The profile converts to
 * the dollar-denominated domain types in `financial.ts` in exactly one place,
 * `src/lib/profile/timeline.ts`, which feeds the same cash-flow engine the demo
 * dataset uses.
 *
 * Schedules are discriminated unions: each frequency carries only the fields
 * it needs, so "a monthly bill without a due day" cannot be represented.
 */

import type { ForecastHorizon } from "@/types/financial";

export const PAY_FREQUENCIES = [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "irregular",
  "none",
] as const;

export type PayFrequency = (typeof PAY_FREQUENCIES)[number];

export const BILL_FREQUENCIES = [
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "one_time",
] as const;

export type BillFrequency = (typeof BILL_FREQUENCIES)[number];

export const BILL_CATEGORIES = [
  "utilities",
  "phone",
  "internet",
  "insurance",
  "car_payment",
  "student_loans",
  "subscriptions",
  "healthcare",
  "other",
] as const;

export type BillCategory = (typeof BILL_CATEGORIES)[number];

export const VARIABLE_SPENDING_CATEGORIES = [
  "groceries",
  "transportation",
  "dining",
  "shopping",
  "entertainment",
  "personal_care",
  "other",
] as const;

export type VariableSpendingCategory =
  (typeof VARIABLE_SPENDING_CATEGORIES)[number];

export type SpendingPeriod = "weekly" | "monthly";

/** Safety targets for the simulation, as fractions. */
export const PROFILE_CONFIDENCES = [0.9, 0.95, 0.99] as const;

export type ProfileConfidence = (typeof PROFILE_CONFIDENCES)[number];

/** A day of the month, 1–31. Days a month lacks fall on its last day. */
export type DayOfMonth = number;

export interface ProfileAccount {
  balanceCents: number;
  currency: "USD";
  /**
   * The calendar day the balance was entered. Forecasts start here: walking
   * forward from a later "today" would silently skip whatever happened to the
   * balance in between.
   */
  balanceAsOf: string;
}

export interface ExpectedPayment {
  id: string;
  date: string;
  amountCents: number;
}

export type ProfileIncome =
  | {
      frequency: "weekly" | "biweekly" | "monthly";
      paycheckAmountCents: number;
      /** Anchors the recurring schedule. Never guessed. */
      nextPayday: string;
    }
  | {
      frequency: "semimonthly";
      paycheckAmountCents: number;
      semimonthlyPaydays: [DayOfMonth, DayOfMonth];
    }
  | {
      frequency: "irregular";
      /** Typical amount, informational only; scheduling uses `expectedPayments`. */
      paycheckAmountCents: number;
      /** May be empty: the user can decline to schedule irregular income. */
      expectedPayments: ExpectedPayment[];
    }
  | {
      frequency: "none";
      paycheckAmountCents: 0;
    };

export interface ProfileHousing {
  /** `0` for someone with no rent or mortgage. */
  amountCents: number;
  /** Required when `amountCents > 0`, otherwise `null`. */
  dueDay: DayOfMonth | null;
}

export type ProfileBillSchedule =
  | {
      frequency: "weekly" | "biweekly" | "one_time";
      nextDueDate: string;
    }
  | { frequency: "monthly"; dueDay: DayOfMonth }
  | { frequency: "semimonthly"; dueDays: [DayOfMonth, DayOfMonth] };

export type ProfileBill = {
  id: string;
  name: string;
  category: BillCategory;
  amountCents: number;
} & ProfileBillSchedule;

export interface ProfileVariableSpending {
  /** The period the user entered amounts in; see `monthlyVariableSpendingCents`. */
  period: SpendingPeriod;
  amountsCents: Record<VariableSpendingCategory, number>;
}

export interface ProfilePreferences {
  protectedMinimumCents: number;
  targetConfidence: ProfileConfidence;
  horizonDays: ForecastHorizon;
}

/**
 * `user_entered` profiles come from onboarding. `demo` is the seeded Alex
 * Morgan profile, whose dashboard is served by the mock dataset with its real
 * transaction history.
 */
export type ProfileSource = "user_entered" | "demo";

export interface FinancialProfile {
  schemaVersion: 1;
  id: string;
  source: ProfileSource;
  account: ProfileAccount;
  income: ProfileIncome;
  housing: ProfileHousing;
  recurringBills: ProfileBill[];
  variableSpending: ProfileVariableSpending;
  emergencies: { enabled: boolean };
  preferences: ProfilePreferences;
  /** ISO timestamp. */
  completedAt: string;
  /** ISO timestamp, bumped on every edit. */
  updatedAt: string;
}

/**
 * Onboarding answers in progress.
 *
 * Unlike `FinancialProfile`, every answer may still be missing (`null`), so a
 * half-finished questionnaire can be saved and resumed. `draftToProfile`
 * turns a complete draft into a validated profile.
 */
export interface OnboardingDraft {
  schemaVersion: 1;
  /** Index of the wizard step the user is on, `0`–`3`. */
  step: number;
  /** Which saved profile, if any, the answers were loaded from. */
  basedOn: "blank" | "personal" | "demo";
  /** Set once the review screen has been reached, so steps can return to it. */
  reviewed: boolean;
  balanceCents: number | null;
  paycheckAmountCents: number | null;
  payFrequency: PayFrequency | null;
  nextPayday: string | null;
  semimonthlyPaydays: [DayOfMonth | null, DayOfMonth | null];
  expectedPayments: ExpectedPayment[];
  noHousingPayment: boolean;
  housingAmountCents: number | null;
  housingDueDay: DayOfMonth | null;
  /** Each bill is validated when it is added, so these are always complete. */
  bills: ProfileBill[];
  spendingPeriod: SpendingPeriod;
  spendingCents: Record<VariableSpendingCategory, number | null>;
  emergenciesEnabled: boolean;
  protectedMinimumCents: number | null;
  targetConfidence: ProfileConfidence;
  horizonDays: ForecastHorizon;
}
