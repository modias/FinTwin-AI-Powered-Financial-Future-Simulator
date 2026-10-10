import { describe, expect, it } from "vitest";

import { estimateSafeToSpend } from "@/services/safe-to-spend";
import type { CashFlowEvent } from "@/types/financial";

const ACCOUNT = "acc_test";

function event(overrides: Partial<CashFlowEvent>): CashFlowEvent {
  return {
    id: "e",
    accountId: ACCOUNT,
    name: "Event",
    category: "Housing",
    amount: 100,
    date: "2026-10-20",
    direction: "expense",
    confidence: "scheduled",
    sourceId: "s",
    ...overrides,
  };
}

const windowEvents: CashFlowEvent[] = [
  event({ id: "rent", name: "Rent", amount: 850 }),
  event({ id: "phone", name: "Phone", amount: 75, category: "Utilities" }),
  event({
    id: "groceries",
    name: "Groceries",
    amount: 200,
    category: "Food",
    confidence: "estimated",
  }),
  event({
    id: "paycheck",
    name: "Paycheck",
    amount: 1500,
    category: "Income",
    direction: "income",
  }),
];

describe("estimateSafeToSpend", () => {
  const estimate = estimateSafeToSpend({
    currentBalance: 2143,
    minimumProtectedBalance: 300,
    windowEvents,
    reservationWindowDays: 30,
  });

  it("subtracts scheduled bills, estimated essentials and the protected floor", () => {
    expect(estimate.reservedUpcomingBills).toBe(925);
    expect(estimate.expectedEssentialExpenses).toBe(200);
    expect(estimate.amount).toBe(718);
  });

  it("ignores upcoming income, keeping the estimate conservative", () => {
    const withoutIncome = estimateSafeToSpend({
      currentBalance: 2143,
      minimumProtectedBalance: 300,
      windowEvents: windowEvents.filter((item) => item.direction === "expense"),
      reservationWindowDays: 30,
    });

    expect(withoutIncome.amount).toBe(estimate.amount);
  });

  it("clamps a negative result to zero and keeps the raw value", () => {
    const clamped = estimateSafeToSpend({
      currentBalance: 500,
      minimumProtectedBalance: 300,
      windowEvents,
      reservationWindowDays: 30,
    });

    expect(clamped.amount).toBe(0);
    expect(clamped.clamped).toBe(true);
    expect(clamped.rawAmount).toBe(-925);
  });

  it("does not report a clamp when the result is already positive", () => {
    expect(estimate.clamped).toBe(false);
    expect(estimate.rawAmount).toBe(718);
  });

  it("falls as the protected balance rises, dollar for dollar", () => {
    const stricter = estimateSafeToSpend({
      currentBalance: 2143,
      minimumProtectedBalance: 500,
      windowEvents,
      reservationWindowDays: 30,
    });

    expect(stricter.amount).toBe(estimate.amount - 200);
  });

  it("produces a breakdown that reconciles with the result", () => {
    const reconciled = estimate.breakdown.reduce(
      (total, line) =>
        line.effect === "add" ? total + line.amount : total - line.amount,
      0,
    );

    expect(reconciled).toBe(estimate.rawAmount);
    expect(estimate.breakdown).toHaveLength(4);
  });

  it("labels itself as the Phase 1 placeholder", () => {
    expect(estimate.method).toBe("illustrative-placeholder");
  });

  it("returns the balance above the floor when nothing is scheduled", () => {
    const quiet = estimateSafeToSpend({
      currentBalance: 2143,
      minimumProtectedBalance: 300,
      windowEvents: [],
      reservationWindowDays: 30,
    });

    expect(quiet.amount).toBe(1843);
  });
});
