import { describe, expect, it } from "vitest";

import {
  averageDailySpending,
  buildForecast,
  expandCashFlowEvents,
  forwardWindow,
  largestExpense,
  monthlyRecurringCost,
  roundMoney,
  runwayInDays,
  signedTransactionAmount,
  summarizeCashFlow,
  summarizeSpending,
  topMerchantByFrequency,
  weeklySpending,
} from "@/lib/calculations";
import type {
  Bill,
  CashFlowEvent,
  IncomeSource,
  Transaction,
} from "@/types/financial";

const ACCOUNT = "acc_test";
const OTHER_ACCOUNT = "acc_other";
const REFERENCE = "2026-10-12";

function transaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: "txn",
    accountId: ACCOUNT,
    merchant: "Test Merchant",
    category: "Food",
    amount: 10,
    date: REFERENCE,
    type: "debit",
    description: "Test",
    ...overrides,
  };
}

describe("roundMoney", () => {
  it("rounds to cents and absorbs float drift", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(1126.979999999)).toBe(1126.98);
    expect(roundMoney(2143)).toBe(2143);
  });
});

describe("signedTransactionAmount", () => {
  it("signs by transaction type rather than by the stored amount", () => {
    expect(signedTransactionAmount(transaction({ type: "debit", amount: 75 }))).toBe(
      -75,
    );
    expect(
      signedTransactionAmount(transaction({ type: "credit", amount: 1500 })),
    ).toBe(1500);
  });
});

describe("forwardWindow", () => {
  it("starts the day after the reference date and runs for the full span", () => {
    expect(forwardWindow(REFERENCE, 30)).toEqual({
      start: "2026-10-13",
      end: "2026-11-11",
    });
  });
});

describe("expandCashFlowEvents", () => {
  const bills: Bill[] = [
    {
      id: "bill_rent",
      accountId: ACCOUNT,
      name: "Rent",
      category: "Housing",
      amount: 850,
      cadence: "monthly",
      anchorDate: "2026-10-01",
      confidence: "scheduled",
      autoPay: true,
    },
    {
      id: "bill_groceries",
      accountId: ACCOUNT,
      name: "Groceries",
      category: "Food",
      amount: 200,
      cadence: "biweekly",
      anchorDate: "2026-10-17",
      confidence: "estimated",
      autoPay: false,
    },
    {
      id: "bill_other_account",
      accountId: OTHER_ACCOUNT,
      name: "Should be excluded",
      category: "Housing",
      amount: 999,
      cadence: "monthly",
      anchorDate: "2026-10-20",
      confidence: "scheduled",
      autoPay: true,
    },
  ];

  const incomeSources: IncomeSource[] = [
    {
      id: "inc_paycheck",
      accountId: ACCOUNT,
      name: "Paycheck",
      payer: "Northwind Labs",
      amount: 1500,
      cadence: "biweekly",
      anchorDate: "2026-10-09",
      confidence: "scheduled",
    },
  ];

  const oneOffEvents: CashFlowEvent[] = [
    {
      id: "evt_outside_window",
      accountId: ACCOUNT,
      name: "Too far out",
      category: "Shopping",
      amount: 540,
      date: "2026-12-19",
      direction: "expense",
      confidence: "estimated",
      sourceId: "evt_outside_window",
    },
  ];

  const window = forwardWindow(REFERENCE, 30);

  const events = expandCashFlowEvents({
    accountId: ACCOUNT,
    start: window.start,
    end: window.end,
    bills,
    incomeSources,
    oneOffEvents,
  });

  it("expands recurrences into dated occurrences inside the window", () => {
    expect(events.map((event) => [event.name, event.date])).toEqual([
      ["Groceries", "2026-10-17"],
      ["Paycheck", "2026-10-23"],
      ["Groceries", "2026-10-31"],
      ["Rent", "2026-11-01"],
      ["Paycheck", "2026-11-06"],
    ]);
  });

  it("excludes other accounts and events outside the window", () => {
    expect(events.some((event) => event.accountId !== ACCOUNT)).toBe(false);
    expect(events.some((event) => event.name === "Too far out")).toBe(false);
  });

  it("carries the source id so an occurrence can be traced back", () => {
    expect(events.find((event) => event.name === "Rent")?.sourceId).toBe(
      "bill_rent",
    );
  });

  it("puts income before expenses on the same day", () => {
    const sameDay = expandCashFlowEvents({
      accountId: ACCOUNT,
      start: "2026-11-01",
      end: "2026-11-01",
      bills,
      incomeSources: [{ ...incomeSources[0], anchorDate: "2026-11-01" }],
    });

    expect(sameDay.map((event) => event.direction)).toEqual([
      "income",
      "expense",
    ]);
  });
});

describe("buildForecast", () => {
  const events: CashFlowEvent[] = [
    {
      id: "e1",
      accountId: ACCOUNT,
      name: "Utilities",
      category: "Utilities",
      amount: 80,
      date: "2026-10-14",
      direction: "expense",
      confidence: "scheduled",
      sourceId: "b1",
    },
    {
      id: "e2",
      accountId: ACCOUNT,
      name: "Groceries",
      category: "Food",
      amount: 200,
      date: "2026-10-15",
      direction: "expense",
      confidence: "estimated",
      sourceId: "b2",
    },
    {
      id: "e3",
      accountId: ACCOUNT,
      name: "Paycheck",
      category: "Income",
      amount: 1500,
      date: "2026-10-16",
      direction: "income",
      confidence: "scheduled",
      sourceId: "i1",
    },
  ];

  const series = buildForecast({
    accountId: ACCOUNT,
    startDate: REFERENCE,
    startingBalance: 2143,
    protectedBalance: 300,
    horizonDays: 5,
    events,
  });

  it("includes today plus every day of the horizon", () => {
    expect(series.points).toHaveLength(6);
    expect(series.points[0].date).toBe(REFERENCE);
    expect(series.points[5].date).toBe("2026-10-17");
  });

  it("starts from the account's actual balance", () => {
    expect(series.points[0].projectedBalance).toBe(2143);
  });

  it("walks the balance through each day's events", () => {
    expect(series.points.map((point) => point.projectedBalance)).toEqual([
      2143, 2143, 2063, 1863, 3363, 3363,
    ]);
  });

  it("separates scheduled bills from estimated spending on each day", () => {
    const groceryDay = series.points[3];

    expect(groceryDay.bills).toBe(0);
    expect(groceryDay.estimatedSpending).toBe(200);
    expect(series.points[2].bills).toBe(80);
  });

  it("reports the trough and the ending balance", () => {
    expect(series.lowestProjectedBalance).toBe(1863);
    expect(series.lowestProjectedBalanceDate).toBe("2026-10-15");
    expect(series.endingBalance).toBe(3363);
  });

  it("counts days spent below the protected balance", () => {
    expect(series.daysBelowProtectedBalance).toBe(0);

    const stressed = buildForecast({
      accountId: ACCOUNT,
      startDate: REFERENCE,
      startingBalance: 400,
      protectedBalance: 300,
      horizonDays: 5,
      events: [events[0], events[1]],
    });

    // Below 300 from 2026-10-14 (320 - ... ) onwards: 14th is 320, so the dip
    // starts on the 15th and holds for the remaining three days.
    expect(stressed.daysBelowProtectedBalance).toBe(3);
  });

  it("labels itself as deterministic rather than simulated", () => {
    expect(series.method).toBe("deterministic-illustrative");
  });

  it("repeats the protected balance on every point for the threshold line", () => {
    expect(
      series.points.every((point) => point.protectedBalance === 300),
    ).toBe(true);
  });

  it("is deterministic: the same inputs give the same output", () => {
    const repeat = buildForecast({
      accountId: ACCOUNT,
      startDate: REFERENCE,
      startingBalance: 2143,
      protectedBalance: 300,
      horizonDays: 5,
      events,
    });

    expect(repeat).toEqual(series);
  });
});

describe("summarizeSpending", () => {
  const transactions: Transaction[] = [
    transaction({ id: "a", category: "Housing", amount: 850, date: "2026-10-01" }),
    transaction({ id: "b", category: "Food", amount: 100, date: "2026-10-05" }),
    transaction({ id: "c", category: "Food", amount: 50, date: "2026-10-10" }),
    // Credits are income, not spending.
    transaction({
      id: "d",
      category: "Income",
      amount: 1500,
      date: "2026-10-09",
      type: "credit",
    }),
    // Outside the trailing window.
    transaction({ id: "e", category: "Shopping", amount: 400, date: "2026-08-01" }),
    // Another account.
    transaction({
      id: "f",
      accountId: OTHER_ACCOUNT,
      category: "Shopping",
      amount: 999,
      date: "2026-10-02",
    }),
  ];

  const summary = summarizeSpending({
    accountId: ACCOUNT,
    transactions,
    periodEnd: REFERENCE,
    periodDays: 30,
  });

  it("covers an inclusive trailing window", () => {
    expect(summary.periodStart).toBe("2026-09-13");
    expect(summary.periodEnd).toBe(REFERENCE);
  });

  it("totals only this account's debits inside the window", () => {
    expect(summary.total).toBe(1000);
    expect(summary.transactionCount).toBe(3);
  });

  it("derives category totals and percentages from the same pass", () => {
    expect(summary.categories).toEqual([
      { category: "Housing", total: 850, percentage: 85, transactionCount: 1 },
      { category: "Food", total: 150, percentage: 15, transactionCount: 2 },
    ]);
  });

  it("percentages sum to 100 and the top category is the largest", () => {
    const sum = summary.categories.reduce(
      (total, entry) => total + entry.percentage,
      0,
    );

    expect(sum).toBeCloseTo(100, 1);
    expect(summary.topCategory?.category).toBe("Housing");
  });

  it("category totals reconcile with the reported total", () => {
    const sum = summary.categories.reduce(
      (total, entry) => total + entry.total,
      0,
    );

    expect(roundMoney(sum)).toBe(summary.total);
  });

  it("returns an empty, zeroed summary when there is nothing to total", () => {
    const empty = summarizeSpending({
      accountId: "acc_missing",
      transactions,
      periodEnd: REFERENCE,
      periodDays: 30,
    });

    expect(empty.total).toBe(0);
    expect(empty.categories).toEqual([]);
    expect(empty.topCategory).toBeNull();
  });

  it("averages spend across the period length", () => {
    expect(averageDailySpending(summary)).toBe(roundMoney(1000 / 30));
  });

  it("reports runway at the current spend rate", () => {
    expect(runwayInDays(1000, summary)).toBe(30);
    expect(
      runwayInDays(
        1000,
        summarizeSpending({
          accountId: "acc_missing",
          transactions,
          periodEnd: REFERENCE,
          periodDays: 30,
        }),
      ),
    ).toBeNull();
  });
});

describe("transaction analytics", () => {
  const transactions: Transaction[] = [
    transaction({ id: "a", merchant: "Shell", amount: 48.2, date: "2026-10-03" }),
    transaction({ id: "b", merchant: "Shell", amount: 51.07, date: "2026-10-10" }),
    transaction({
      id: "c",
      merchant: "Northfield Properties",
      amount: 850,
      date: "2026-10-01",
    }),
    transaction({
      id: "d",
      merchant: "Northwind Labs",
      amount: 1500,
      date: "2026-10-09",
      type: "credit",
    }),
  ];

  it("splits credits from debits and nets them", () => {
    expect(
      summarizeCashFlow(transactions, ACCOUNT, "2026-09-13", REFERENCE),
    ).toEqual({ income: 1500, spending: 949.27, net: 550.73 });
  });

  it("finds the largest debit, ignoring credits", () => {
    expect(
      largestExpense(transactions, ACCOUNT, "2026-09-13", REFERENCE)?.merchant,
    ).toBe("Northfield Properties");
  });

  it("ranks merchants by visit count", () => {
    expect(
      topMerchantByFrequency(transactions, ACCOUNT, "2026-09-13", REFERENCE),
    ).toEqual({ merchant: "Shell", count: 2, total: 99.27 });
  });

  it("buckets spending into 7-day windows ending on the period end", () => {
    const weeks = weeklySpending(
      transactions,
      ACCOUNT,
      "2026-09-29",
      REFERENCE,
    );

    expect(weeks).toHaveLength(2);
    expect(weeks[weeks.length - 1].label).toBe("This week");
    expect(roundMoney(weeks.reduce((sum, week) => sum + week.total, 0))).toBe(
      949.27,
    );
  });
});

describe("monthlyRecurringCost", () => {
  it("normalises every cadence to a monthly figure", () => {
    const bills: Bill[] = [
      {
        id: "monthly",
        accountId: ACCOUNT,
        name: "Rent",
        category: "Housing",
        amount: 850,
        cadence: "monthly",
        anchorDate: "2026-10-01",
        confidence: "scheduled",
        autoPay: true,
      },
      {
        id: "biweekly",
        accountId: ACCOUNT,
        name: "Groceries",
        category: "Food",
        amount: 200,
        cadence: "biweekly",
        anchorDate: "2026-10-17",
        confidence: "estimated",
        autoPay: false,
      },
    ];

    const cost = monthlyRecurringCost(bills, ACCOUNT);

    expect(cost.scheduled).toBe(850);
    expect(cost.estimated).toBe(roundMoney(200 * (26 / 12)));
    expect(cost.total).toBe(roundMoney(cost.scheduled + cost.estimated));
  });
});
