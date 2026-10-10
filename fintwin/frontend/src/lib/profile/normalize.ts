/**
 * Monthly normalisation for profile amounts, in integer cents.
 *
 * The review screen's income-vs-expenses comparison and the estimate-based
 * spending breakdown both use these, so the two always agree. A month is
 * 52/12 weeks; results are rounded to the nearest cent once, at the end.
 */

import { forwardWindow } from "@/lib/calculations";
import { EMERGENCY_ASSUMPTIONS } from "@/lib/constants";
import {
  VARIABLE_SPENDING_CATEGORIES,
  type BillFrequency,
  type FinancialProfile,
  type PayFrequency,
  type ProfileBill,
  type ProfileIncome,
  type SpendingPeriod,
  type VariableSpendingCategory,
} from "@/types/profile";

const WEEKS_PER_MONTH = 52 / 12;

/** How many times a schedule repeats in an average month; `0` for one-off events. */
export const OCCURRENCES_PER_MONTH: Record<
  Exclude<BillFrequency | PayFrequency, "irregular" | "none">,
  number
> = {
  weekly: WEEKS_PER_MONTH,
  biweekly: WEEKS_PER_MONTH / 2,
  semimonthly: 2,
  monthly: 1,
  one_time: 0,
};

/** Converts an amount entered per `period` to a monthly amount. */
export function toMonthlyCents(amountCents: number, period: SpendingPeriod): number {
  return period === "weekly"
    ? Math.round(amountCents * WEEKS_PER_MONTH)
    : amountCents;
}

/** Converts a monthly amount back to the period the user is entering in. */
export function fromMonthlyCents(monthlyCents: number, period: SpendingPeriod): number {
  return period === "weekly"
    ? Math.round(monthlyCents / WEEKS_PER_MONTH)
    : monthlyCents;
}

/** Every variable-spending category as a monthly amount. Missing entries count as zero. */
export function monthlyVariableSpendingByCategory(
  amountsCents: Partial<Record<VariableSpendingCategory, number | null>>,
  period: SpendingPeriod,
): Record<VariableSpendingCategory, number> {
  return Object.fromEntries(
    VARIABLE_SPENDING_CATEGORIES.map((category) => [
      category,
      toMonthlyCents(amountsCents[category] ?? 0, period),
    ]),
  ) as Record<VariableSpendingCategory, number>;
}

/** Sum of monthly variable spending. Normalises the total, not each line, to avoid rounding drift. */
export function monthlyVariableSpendingCents(
  amountsCents: Partial<Record<VariableSpendingCategory, number | null>>,
  period: SpendingPeriod,
): number {
  const total = VARIABLE_SPENDING_CATEGORIES.reduce(
    (sum, category) => sum + (amountsCents[category] ?? 0),
    0,
  );

  return toMonthlyCents(total, period);
}

/** A recurring bill's average monthly cost. One-time bills are excluded. */
export function monthlyBillCents(bill: ProfileBill): number {
  return Math.round(bill.amountCents * OCCURRENCES_PER_MONTH[bill.frequency]);
}

export function monthlyRecurringBillsCents(bills: readonly ProfileBill[]): number {
  return bills.reduce((sum, bill) => sum + monthlyBillCents(bill), 0);
}

/** The unexpected-expense allowance spread across an average month. */
export function monthlyEmergencyAllowanceCents(): number {
  return Math.round(
    (EMERGENCY_ASSUMPTIONS.averageCostCents * EMERGENCY_ASSUMPTIONS.eventsPerYear) /
      12,
  );
}

/** The same allowance as a weekly amount, which is how it enters the timeline. */
export function weeklyEmergencyAllowanceCents(): number {
  return Math.round(
    (EMERGENCY_ASSUMPTIONS.averageCostCents * EMERGENCY_ASSUMPTIONS.eventsPerYear) /
      52,
  );
}

export interface MonthlyIncomeEstimate {
  monthlyCents: number;
  /**
   * `schedule` income repeats predictably. `expected_payments` sums irregular
   * payments the user listed in the next 30 days. `none` means no income is
   * scheduled at all.
   */
  basis: "schedule" | "expected_payments" | "none";
}

export function monthlyIncome(
  income: ProfileIncome,
  referenceDate: string,
): MonthlyIncomeEstimate {
  switch (income.frequency) {
    case "weekly":
    case "biweekly":
    case "semimonthly":
    case "monthly":
      return {
        monthlyCents: Math.round(
          income.paycheckAmountCents * OCCURRENCES_PER_MONTH[income.frequency],
        ),
        basis: "schedule",
      };
    case "irregular": {
      const { start, end } = forwardWindow(referenceDate, 30);

      return {
        monthlyCents: income.expectedPayments
          .filter((payment) => payment.date >= start && payment.date <= end)
          .reduce((sum, payment) => sum + payment.amountCents, 0),
        basis: "expected_payments",
      };
    }
    case "none":
      return { monthlyCents: 0, basis: "none" };
  }
}

export interface MonthlyBudget {
  incomeCents: number;
  incomeBasis: MonthlyIncomeEstimate["basis"];
  housingCents: number;
  billsCents: number;
  variableSpendingCents: number;
  emergencyAllowanceCents: number;
  expensesCents: number;
  /** Income minus expenses; negative when expenses are higher. */
  differenceCents: number;
}

/** The monthly income-vs-expenses comparison shown on the review screen. */
export function monthlyBudget(
  profile: Pick<
    FinancialProfile,
    "income" | "housing" | "recurringBills" | "variableSpending" | "emergencies"
  >,
  referenceDate: string,
): MonthlyBudget {
  const income = monthlyIncome(profile.income, referenceDate);
  const housingCents = profile.housing.amountCents;
  const billsCents = monthlyRecurringBillsCents(profile.recurringBills);
  const variableSpendingCents = monthlyVariableSpendingCents(
    profile.variableSpending.amountsCents,
    profile.variableSpending.period,
  );
  const emergencyAllowanceCents = profile.emergencies.enabled
    ? monthlyEmergencyAllowanceCents()
    : 0;
  const expensesCents =
    housingCents + billsCents + variableSpendingCents + emergencyAllowanceCents;

  return {
    incomeCents: income.monthlyCents,
    incomeBasis: income.basis,
    housingCents,
    billsCents,
    variableSpendingCents,
    emergencyAllowanceCents,
    expensesCents,
    differenceCents: income.monthlyCents - expensesCents,
  };
}
