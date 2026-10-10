import { describe, expect, it } from "vitest";

import {
  fromMonthlyCents,
  monthlyBillCents,
  monthlyBudget,
  monthlyEmergencyAllowanceCents,
  monthlyIncome,
  monthlyVariableSpendingCents,
  toMonthlyCents,
  weeklyEmergencyAllowanceCents,
} from "@/lib/profile/normalize";

import { TODAY, makeProfile } from "./fixtures";

describe("weekly to monthly normalisation", () => {
  it("uses 52 weeks over 12 months", () => {
    expect(toMonthlyCents(10_000, "weekly")).toBe(43_333);
    expect(toMonthlyCents(1_200, "weekly")).toBe(5_200);
    expect(toMonthlyCents(10_000, "monthly")).toBe(10_000);
  });

  it("converts back for the period toggle", () => {
    expect(fromMonthlyCents(43_333, "weekly")).toBe(10_000);
    expect(fromMonthlyCents(52_000, "weekly")).toBe(12_000);
  });

  it("normalises the total once so rounding does not accumulate per category", () => {
    // Seven categories of $0.01 a week: per-line rounding would give 7 × 4 = 28.
    const amounts = {
      groceries: 1,
      transportation: 1,
      dining: 1,
      shopping: 1,
      entertainment: 1,
      personal_care: 1,
      other: 1,
    };

    expect(monthlyVariableSpendingCents(amounts, "weekly")).toBe(30);
  });

  it("treats blank spending answers as zero", () => {
    expect(monthlyVariableSpendingCents({ groceries: null, dining: 2_000 }, "monthly")).toBe(
      2_000,
    );
  });

  it("normalises bills by frequency and leaves one-time bills out", () => {
    const base = { id: "b", name: "Bill", category: "other" as const, amountCents: 1_000 };

    expect(monthlyBillCents({ ...base, frequency: "monthly", dueDay: 5 })).toBe(1_000);
    expect(monthlyBillCents({ ...base, frequency: "semimonthly", dueDays: [1, 15] })).toBe(
      2_000,
    );
    expect(monthlyBillCents({ ...base, frequency: "weekly", nextDueDate: "2026-10-15" })).toBe(
      4_333,
    );
    expect(
      monthlyBillCents({ ...base, frequency: "biweekly", nextDueDate: "2026-10-15" }),
    ).toBe(2_167);
    expect(
      monthlyBillCents({ ...base, frequency: "one_time", nextDueDate: "2026-11-15" }),
    ).toBe(0);
  });

  it("spreads the unexpected-expense allowance evenly", () => {
    // $600 × 3 a year.
    expect(monthlyEmergencyAllowanceCents()).toBe(15_000);
    expect(weeklyEmergencyAllowanceCents()).toBe(3_462);
  });
});

describe("monthlyIncome", () => {
  it("averages scheduled pay per month", () => {
    expect(
      monthlyIncome({ frequency: "weekly", paycheckAmountCents: 100_000, nextPayday: "2026-10-16" }, TODAY),
    ).toEqual({ monthlyCents: 433_333, basis: "schedule" });
    expect(
      monthlyIncome({ frequency: "biweekly", paycheckAmountCents: 150_000, nextPayday: "2026-10-16" }, TODAY),
    ).toEqual({ monthlyCents: 325_000, basis: "schedule" });
    expect(
      monthlyIncome({ frequency: "semimonthly", paycheckAmountCents: 150_000, semimonthlyPaydays: [1, 15] }, TODAY),
    ).toEqual({ monthlyCents: 300_000, basis: "schedule" });
  });

  it("counts only the irregular payments the user listed in the next 30 days", () => {
    const income = {
      frequency: "irregular" as const,
      paycheckAmountCents: 0,
      expectedPayments: [
        { id: "a", date: "2026-10-20", amountCents: 40_000 },
        { id: "b", date: "2026-11-11", amountCents: 25_000 },
        { id: "c", date: "2026-11-12", amountCents: 99_900 },
      ],
    };

    expect(monthlyIncome(income, TODAY)).toEqual({
      monthlyCents: 65_000,
      basis: "expected_payments",
    });
  });

  it("is zero with no regular income", () => {
    expect(monthlyIncome({ frequency: "none", paycheckAmountCents: 0 }, TODAY)).toEqual({
      monthlyCents: 0,
      basis: "none",
    });
  });
});

describe("monthlyBudget", () => {
  it("reports a shortfall when expenses exceed income", () => {
    const budget = monthlyBudget(
      makeProfile({
        income: { frequency: "monthly", paycheckAmountCents: 100_000, nextPayday: "2026-11-01" },
        housing: { amountCents: 120_000, dueDay: 1 },
        emergencies: { enabled: true },
      }),
      TODAY,
    );

    expect(budget.expensesCents).toBe(135_000);
    expect(budget.differenceCents).toBe(-35_000);
  });
});
