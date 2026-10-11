/**
 * Modelling assumptions, and calibration from transaction history.
 *
 * Everything the engine assumes rather than reads from the user's data lives
 * here, with its reasoning, so it can be disclosed next to every result.
 * None of these numbers is a fact about the user.
 *
 * Variable spending
 *   Each estimated spending occurrence (a week of groceries, say) is drawn as
 *   `expected × L × E`, where
 *    - `E` is lognormal with mean 1 and the kind's per-occurrence variation:
 *      week-to-week noise, independent across occurrences;
 *    - `L` is lognormal with mean 1 and the kind's level variation, drawn
 *      once per path: the chance that the estimate itself is off, which
 *      persists for the whole horizon instead of averaging out.
 *   The expectation is unchanged, amounts can never be negative, and the
 *   right skew means overspending is likelier to be large than underspending.
 *
 *   With transaction history (at least `HISTORY_REQUIREMENTS`), weekly
 *   variation is measured from weekly totals and level variation is the
 *   relative standard error of their mean. Without it, the fallbacks below
 *   apply.
 *
 * Unexpected expenses
 *   Poisson arrivals at `eventsPerYear`, lognormal costs with mean
 *   `meanCostCents` and variation `costVariation`, capped at `maxCostCents`.
 *   They replace the weekly planning allowance in the profile timeline, so
 *   emergencies are never counted twice.
 */

import { addDays, differenceInDays } from "@/lib/dates";
import { EMERGENCY_ASSUMPTIONS } from "@/lib/constants";
import { dollarsToCents } from "@/lib/money";
import type {
  EmergencyAssumptions,
  SpendingKindAssumptions,
  SpendingModel,
  VariableSpendingKind,
} from "@/simulation/types";
import type {
  Bill,
  CashFlowEvent,
  SpendingKind,
  Transaction,
  TransactionCategory,
} from "@/types/financial";

/** 10,000 paths keeps the sampling error of a 95% probability near ±0.2 points. */
export const DEFAULT_PATH_COUNT = 10_000;

/** A fixed default seed, so the same inputs always give the same results. */
export const DEFAULT_SEED = 20_261_012;

/**
 * Bumped whenever the engine's maths changes, so cached paths from an older
 * engine are never reused.
 */
export const ENGINE_VERSION = 1;

/**
 * Variation assumed without history. Essential spending (groceries,
 * transport) is steadier week to week than discretionary spending; the
 * level variation allows a user's estimate to be about 10% off in either
 * direction for the whole horizon.
 */
export const FALLBACK_SPENDING_VARIATION: Record<
  VariableSpendingKind,
  { weeklyVariation: number; levelVariation: number }
> = {
  essential: { weeklyVariation: 0.15, levelVariation: 0.1 },
  discretionary: { weeklyVariation: 0.4, levelVariation: 0.1 },
};

/** Minimum history before variation is measured instead of assumed. */
export const HISTORY_REQUIREMENTS = { minWeeks: 4, minTransactions: 6 } as const;

/** Measured variation is kept inside this range, so a short history cannot claim certainty. */
export const VARIATION_BOUNDS = { min: 0.05, max: 1.5 } as const;

export const EMERGENCY_MODEL: EmergencyAssumptions = {
  basis: "assumption",
  eventsPerYear: EMERGENCY_ASSUMPTIONS.eventsPerYear,
  meanCostCents: EMERGENCY_ASSUMPTIONS.averageCostCents,
  // A standard deviation equal to the mean: most surprises are a few hundred
  // dollars, a few are well over a thousand.
  costVariation: 1,
  maxCostCents: 500_000,
};

/** Transaction categories that represent variable spending, by kind. */
const VARIABLE_CATEGORY_KIND: Partial<Record<TransactionCategory, VariableSpendingKind>> = {
  Food: "essential",
  Transportation: "essential",
  Healthcare: "essential",
  Shopping: "discretionary",
  Entertainment: "discretionary",
  "Personal Care": "discretionary",
  Other: "discretionary",
};

const ESSENTIAL_CATEGORIES = new Set<TransactionCategory>([
  "Housing",
  "Utilities",
  "Food",
  "Transportation",
  "Healthcare",
  "Insurance",
  "Debt",
]);

/** What an estimated expense represents, from its explicit kind or its category. */
export function spendingKindOf(event: Pick<CashFlowEvent, "spendingKind" | "category">): SpendingKind {
  if (event.spendingKind) return event.spendingKind;

  return ESSENTIAL_CATEGORIES.has(event.category) ? "essential" : "discretionary";
}

function clampVariation(value: number): number {
  return Math.min(VARIATION_BOUNDS.max, Math.max(VARIATION_BOUNDS.min, value));
}

function fallback(kind: VariableSpendingKind): SpendingKindAssumptions {
  return { kind, basis: "fallback", ...FALLBACK_SPENDING_VARIATION[kind], history: null };
}

interface CalibrationOptions {
  accountId: string;
  referenceDate: string;
  transactions: readonly Transaction[];
  /** Scheduled bills, whose payments are not variable spending. */
  bills: readonly Bill[];
}

/**
 * Measures weekly variable spending from history.
 *
 * Uses the most recent whole weeks before the reference date. Debits that
 * match a scheduled bill (same category, same amount) are fixed obligations,
 * not variable spending, and are left out; so are categories that are never
 * variable (rent, utilities, subscriptions).
 */
export function calibrateSpendingModel({
  accountId,
  referenceDate,
  transactions,
  bills,
}: CalibrationOptions): SpendingModel {
  const history = transactions.filter(
    (transaction) => transaction.accountId === accountId && transaction.date < referenceDate,
  );

  if (history.length === 0) {
    return {
      distribution: "lognormal",
      essential: fallback("essential"),
      discretionary: fallback("discretionary"),
    };
  }

  const firstDate = history.reduce(
    (earliest, transaction) => (transaction.date < earliest ? transaction.date : earliest),
    history[0].date,
  );
  const lastDay = addDays(referenceDate, -1);
  const weeks = Math.floor((differenceInDays(firstDate, lastDay) + 1) / 7);
  const windowStart = addDays(lastDay, -(weeks * 7 - 1));

  const scheduledAmounts = new Set(
    bills
      .filter((bill) => bill.accountId === accountId && bill.confidence === "scheduled")
      .map((bill) => `${bill.category}:${dollarsToCents(bill.amount)}`),
  );

  const weekly: Record<VariableSpendingKind, number[]> = {
    essential: Array.from({ length: weeks }, () => 0),
    discretionary: Array.from({ length: weeks }, () => 0),
  };
  const counts: Record<VariableSpendingKind, number> = { essential: 0, discretionary: 0 };

  for (const transaction of history) {
    if (transaction.type !== "debit" || transaction.date < windowStart) continue;

    const kind = VARIABLE_CATEGORY_KIND[transaction.category];
    const cents = dollarsToCents(transaction.amount);

    if (!kind || scheduledAmounts.has(`${transaction.category}:${cents}`)) continue;

    const week = Math.floor(differenceInDays(windowStart, transaction.date) / 7);
    weekly[kind][week] += cents;
    counts[kind] += 1;
  }

  const measure = (kind: VariableSpendingKind): SpendingKindAssumptions => {
    const totals = weekly[kind];

    if (weeks < HISTORY_REQUIREMENTS.minWeeks || counts[kind] < HISTORY_REQUIREMENTS.minTransactions) {
      return fallback(kind);
    }

    const mean = totals.reduce((sum, value) => sum + value, 0) / weeks;

    if (mean <= 0) return fallback(kind);

    const variance =
      totals.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (weeks - 1);
    const weeklyVariation = clampVariation(Math.sqrt(variance) / mean);

    return {
      kind,
      basis: "transaction_history",
      weeklyVariation,
      levelVariation: clampVariation(weeklyVariation / Math.sqrt(weeks)),
      history: { weeks, transactions: counts[kind], weeklyMeanCents: Math.round(mean) },
    };
  };

  return {
    distribution: "lognormal",
    essential: measure("essential"),
    discretionary: measure("discretionary"),
  };
}

/**
 * Variation of one occurrence covering `periodDays` of spending. Independent
 * weekly noise adds up, so a two-week total varies by 1/√2 as much,
 * relative to its size, as a one-week total.
 */
export function occurrenceVariation(weeklyVariation: number, periodDays: number): number {
  return weeklyVariation * Math.sqrt(7 / Math.max(periodDays, 7));
}
