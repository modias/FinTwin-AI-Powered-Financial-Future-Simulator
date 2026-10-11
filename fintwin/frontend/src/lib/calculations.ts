/**
 * Pure financial calculations.
 *
 * Nothing here touches React, the network or the clock — every function is a
 * deterministic transform of its inputs, which is what keeps the unit tests
 * meaningful.
 *
 * `expandCashFlowEvents` produces the canonical cash-flow timeline. The Monte
 * Carlo engine in `src/simulation` builds every simulated path from it, and
 * the upcoming-events list shows the same events, so there is one timeline.
 */

import { addDays, differenceInDays, occurrencesBetween } from "@/lib/dates";
import {
  SPENDING_CATEGORIES,
  type Bill,
  type CashFlowEvent,
  type CategorySpend,
  type IncomeSource,
  type SpendingCategory,
  type SpendingEstimate,
  type SpendingSummary,
  type Transaction,
} from "@/types/financial";

/** Rounds to cents, keeping repeated additions from accumulating float noise. */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/** Positive for money arriving, negative for money leaving. */
export function signedTransactionAmount(transaction: Transaction): number {
  return transaction.type === "credit" ? transaction.amount : -transaction.amount;
}

export function sumBy<T>(items: readonly T[], select: (item: T) => number): number {
  return roundMoney(items.reduce((total, item) => total + select(item), 0));
}

/**
 * The window every forward-looking figure uses: the day after the reference
 * date through `days` days later. "Today" is excluded because the reference
 * date's own activity is already reflected in the current balance.
 */
export function forwardWindow(
  referenceDate: string,
  days: number,
): { start: string; end: string } {
  return { start: addDays(referenceDate, 1), end: addDays(referenceDate, days) };
}

interface ExpandEventsOptions {
  accountId: string;
  start: string;
  end: string;
  bills: readonly Bill[];
  incomeSources: readonly IncomeSource[];
  oneOffEvents?: readonly CashFlowEvent[];
}

/**
 * Expands recurring bills and income sources into concrete dated events inside
 * `[start, end]`, merged with any one-off events in the same window.
 *
 * Results are sorted by date, then income before expenses on the same day
 * (money lands before it leaves), then by id so the order is stable.
 */
export function expandCashFlowEvents({
  accountId,
  start,
  end,
  bills,
  incomeSources,
  oneOffEvents = [],
}: ExpandEventsOptions): CashFlowEvent[] {
  const events: CashFlowEvent[] = [];

  for (const bill of bills) {
    if (bill.accountId !== accountId) continue;

    for (const date of occurrencesBetween(bill.anchorDate, bill.cadence, start, end)) {
      events.push({
        id: `${bill.id}@${date}`,
        accountId: bill.accountId,
        name: bill.name,
        category: bill.category,
        amount: bill.amount,
        date,
        direction: "expense",
        confidence: bill.confidence,
        sourceId: bill.id,
        ...(bill.spendingKind ? { spendingKind: bill.spendingKind } : {}),
      });
    }
  }

  for (const source of incomeSources) {
    if (source.accountId !== accountId) continue;

    for (const date of occurrencesBetween(
      source.anchorDate,
      source.cadence,
      start,
      end,
    )) {
      events.push({
        id: `${source.id}@${date}`,
        accountId: source.accountId,
        name: source.name,
        category: "Income",
        amount: source.amount,
        date,
        direction: "income",
        confidence: source.confidence,
        sourceId: source.id,
      });
    }
  }

  for (const event of oneOffEvents) {
    if (event.accountId !== accountId) continue;
    if (event.date < start || event.date > end) continue;

    events.push(event);
  }

  return events.sort(compareEvents);
}

function compareEvents(a: CashFlowEvent, b: CashFlowEvent): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.direction !== b.direction) return a.direction === "income" ? -1 : 1;

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function isSpendingCategory(category: string): category is SpendingCategory {
  return (SPENDING_CATEGORIES as readonly string[]).includes(category);
}

interface SummarizeSpendingOptions {
  accountId: string;
  transactions: readonly Transaction[];
  /** Inclusive last day of the period. */
  periodEnd: string;
  /** Length of the period in days, inclusive of `periodEnd`. */
  periodDays: number;
}

/**
 * Totals debit transactions by category over a trailing window.
 *
 * Every figure the spending breakdown renders — the total, the per-category
 * amounts, the percentages and the top category — comes from this one pass over
 * the transaction dataset, so the chart can never disagree with the table.
 */
export function summarizeSpending({
  accountId,
  transactions,
  periodEnd,
  periodDays,
}: SummarizeSpendingOptions): SpendingSummary {
  const periodStart = addDays(periodEnd, -(periodDays - 1));
  const totals = new Map<SpendingCategory, { total: number; count: number }>();
  let total = 0;
  let transactionCount = 0;

  for (const transaction of transactions) {
    if (transaction.accountId !== accountId) continue;
    if (transaction.type !== "debit") continue;
    if (transaction.date < periodStart || transaction.date > periodEnd) continue;
    if (!isSpendingCategory(transaction.category)) continue;

    const bucket = totals.get(transaction.category) ?? { total: 0, count: 0 };

    bucket.total += transaction.amount;
    bucket.count += 1;
    totals.set(transaction.category, bucket);

    total += transaction.amount;
    transactionCount += 1;
  }

  total = roundMoney(total);

  const categories: CategorySpend[] = [...totals.entries()]
    .map(([category, bucket]) => ({
      category,
      total: roundMoney(bucket.total),
      percentage: total === 0 ? 0 : roundToTenth((bucket.total / total) * 100),
      transactionCount: bucket.count,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    accountId,
    basis: "transactions",
    periodStart,
    periodEnd,
    periodDays,
    total,
    categories,
    topCategory: categories[0] ?? null,
    transactionCount,
  };
}

interface SummarizeEstimatesOptions {
  accountId: string;
  estimates: readonly SpendingEstimate[];
  referenceDate: string;
}

/**
 * The spending breakdown for a profile with no transaction history: a typical
 * month built from the user's own estimates, covering the month after the
 * reference date. `basis: "estimates"` tells the UI to label it as such.
 */
export function summarizeSpendingEstimates({
  accountId,
  estimates,
  referenceDate,
}: SummarizeEstimatesOptions): SpendingSummary {
  const { start, end } = forwardWindow(referenceDate, 30);
  const total = sumBy(estimates, (estimate) => estimate.monthlyAmount);

  const categories: CategorySpend[] = estimates
    .filter((estimate) => estimate.monthlyAmount > 0)
    .map((estimate) => ({
      category: estimate.category,
      total: roundMoney(estimate.monthlyAmount),
      percentage: total === 0 ? 0 : roundToTenth((estimate.monthlyAmount / total) * 100),
      transactionCount: 0,
    }))
    .sort((a, b) => b.total - a.total);

  return {
    accountId,
    basis: "estimates",
    periodStart: start,
    periodEnd: end,
    periodDays: 30,
    total,
    categories,
    topCategory: categories[0] ?? null,
    transactionCount: 0,
  };
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Average spend per day across the summary's period. */
export function averageDailySpending(summary: SpendingSummary): number {
  return roundMoney(summary.total / summary.periodDays);
}

interface CashFlowTotals {
  income: number;
  spending: number;
  net: number;
}

/** Credits, debits and the difference between them over a trailing window. */
export function summarizeCashFlow(
  transactions: readonly Transaction[],
  accountId: string,
  periodStart: string,
  periodEnd: string,
): CashFlowTotals {
  let income = 0;
  let spending = 0;

  for (const transaction of transactions) {
    if (transaction.accountId !== accountId) continue;
    if (transaction.date < periodStart || transaction.date > periodEnd) continue;

    if (transaction.type === "credit") {
      income += transaction.amount;
    } else {
      spending += transaction.amount;
    }
  }

  return {
    income: roundMoney(income),
    spending: roundMoney(spending),
    net: roundMoney(income - spending),
  };
}

/** The merchant with the most debits in the window, and how much it took. */
export function topMerchantByFrequency(
  transactions: readonly Transaction[],
  accountId: string,
  periodStart: string,
  periodEnd: string,
): { merchant: string; count: number; total: number } | null {
  const merchants = new Map<string, { count: number; total: number }>();

  for (const transaction of transactions) {
    if (transaction.accountId !== accountId) continue;
    if (transaction.type !== "debit") continue;
    if (transaction.date < periodStart || transaction.date > periodEnd) continue;

    const bucket = merchants.get(transaction.merchant) ?? { count: 0, total: 0 };

    bucket.count += 1;
    bucket.total += transaction.amount;
    merchants.set(transaction.merchant, bucket);
  }

  const ranked = [...merchants.entries()].sort(
    (a, b) => b[1].count - a[1].count || b[1].total - a[1].total,
  );

  if (ranked.length === 0) return null;

  const [merchant, bucket] = ranked[0];

  return { merchant, count: bucket.count, total: roundMoney(bucket.total) };
}

/** The single largest debit in the window. */
export function largestExpense(
  transactions: readonly Transaction[],
  accountId: string,
  periodStart: string,
  periodEnd: string,
): Transaction | null {
  let largest: Transaction | null = null;

  for (const transaction of transactions) {
    if (transaction.accountId !== accountId) continue;
    if (transaction.type !== "debit") continue;
    if (transaction.date < periodStart || transaction.date > periodEnd) continue;

    if (!largest || transaction.amount > largest.amount) {
      largest = transaction;
    }
  }

  return largest;
}

/**
 * Normalises every recurring bill on an account to a monthly cost, so weekly
 * and biweekly commitments can be compared with monthly ones.
 */
export function monthlyRecurringCost(
  bills: readonly Bill[],
  accountId: string,
): { scheduled: number; estimated: number; total: number } {
  const occurrencesPerMonth = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1 };
  let scheduled = 0;
  let estimated = 0;

  for (const bill of bills) {
    if (bill.accountId !== accountId) continue;

    const monthly = bill.amount * occurrencesPerMonth[bill.cadence];

    if (bill.confidence === "scheduled") {
      scheduled += monthly;
    } else {
      estimated += monthly;
    }
  }

  return {
    scheduled: roundMoney(scheduled),
    estimated: roundMoney(estimated),
    total: roundMoney(scheduled + estimated),
  };
}

/** Days of cover at the current spending rate, or `null` when nothing is spent. */
export function runwayInDays(
  currentBalance: number,
  summary: SpendingSummary,
): number | null {
  const dailySpend = averageDailySpending(summary);

  if (dailySpend <= 0) return null;

  return Math.floor(currentBalance / dailySpend);
}

export interface WeeklySpend {
  /** Inclusive ISO start date of the week. */
  weekStart: string;
  label: string;
  total: number;
}

/**
 * Buckets debits into consecutive 7-day windows ending on `periodEnd`.
 *
 * Windows are anchored to the period rather than to calendar weeks so the most
 * recent bucket always ends on the reference date and every bucket covers the
 * same number of days.
 */
export function weeklySpending(
  transactions: readonly Transaction[],
  accountId: string,
  periodStart: string,
  periodEnd: string,
): WeeklySpend[] {
  const totalDays = differenceInDays(periodStart, periodEnd) + 1;
  const weekCount = Math.ceil(totalDays / 7);
  const buckets: WeeklySpend[] = [];

  for (let index = 0; index < weekCount; index += 1) {
    const end = addDays(periodEnd, -index * 7);
    const start = addDays(end, -6);

    buckets.push({
      weekStart: start < periodStart ? periodStart : start,
      label: index === 0 ? "This week" : `${index * 7 + 1}–${index * 7 + 7}d ago`,
      total: sumBy(
        transactions.filter(
          (transaction) =>
            transaction.accountId === accountId &&
            transaction.type === "debit" &&
            transaction.date >= start &&
            transaction.date <= end,
        ),
        (transaction) => transaction.amount,
      ),
    });
  }

  return buckets.reverse();
}
