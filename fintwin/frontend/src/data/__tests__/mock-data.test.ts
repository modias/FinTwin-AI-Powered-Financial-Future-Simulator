import { describe, expect, it } from "vitest";

import {
  PRIMARY_ACCOUNT_ID,
  mockAccounts,
  mockUserProfile,
} from "@/data/mock-accounts";
import {
  mockBills,
  mockIncomeSources,
  mockOneOffEvents,
} from "@/data/mock-events";
import { createDemoProfile, demoDataset } from "@/data/demo-profile";
import { mockTransactions } from "@/data/mock-transactions";
import { summarizeSpending } from "@/lib/calculations";
import {
  DEFAULT_PREFERENCES,
  DEMO_REFERENCE_DATE,
  SPENDING_PERIOD_DAYS,
} from "@/lib/constants";
import {
  accountSchema,
  billSchema,
  cashFlowEventSchema,
  incomeSourceSchema,
  transactionSchema,
  userProfileSchema,
} from "@/lib/schemas";
import { createSimulationRuntime } from "@/simulation/engine";
import { buildSimulationInput } from "@/simulation/timeline";
import { SPENDING_CATEGORIES } from "@/types/financial";

/**
 * Guards the demonstration dataset.
 *
 * Phase 1 has no backend, so these invariants are the only thing standing
 * between the UI and numbers that quietly contradict each other. The headline
 * figures quoted in the README are asserted here too, so editing the dataset
 * without updating the docs fails the suite.
 */

const accountIds = new Set(mockAccounts.map((account) => account.id));

describe("mock dataset shape", () => {
  it("validates against the schemas the backend will have to satisfy", () => {
    expect(() => userProfileSchema.parse(mockUserProfile)).not.toThrow();

    for (const account of mockAccounts) {
      expect(() => accountSchema.parse(account)).not.toThrow();
    }
    for (const transaction of mockTransactions) {
      expect(() => transactionSchema.parse(transaction)).not.toThrow();
    }
    for (const bill of mockBills) {
      expect(() => billSchema.parse(bill)).not.toThrow();
    }
    for (const source of mockIncomeSources) {
      expect(() => incomeSourceSchema.parse(source)).not.toThrow();
    }
    for (const event of mockOneOffEvents) {
      expect(() => cashFlowEventSchema.parse(event)).not.toThrow();
    }
  });

  it("meets the Phase 1 dataset minimums", () => {
    expect(mockAccounts.length).toBeGreaterThanOrEqual(2);
    expect(mockTransactions.length).toBeGreaterThanOrEqual(30);

    for (const account of mockAccounts) {
      const owned = mockTransactions.filter(
        (transaction) => transaction.accountId === account.id,
      );

      expect(owned.length).toBeGreaterThanOrEqual(10);
    }
  });

  it("has unique ids", () => {
    const collections = [
      mockAccounts,
      mockTransactions,
      mockBills,
      mockIncomeSources,
      mockOneOffEvents,
    ];

    for (const collection of collections) {
      const ids = collection.map((item) => item.id);

      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("gives every account a different balance", () => {
    const balances = mockAccounts.map((account) => account.currentBalance);

    expect(new Set(balances).size).toBe(balances.length);
  });

  it("references only known accounts", () => {
    for (const item of [
      ...mockTransactions,
      ...mockBills,
      ...mockIncomeSources,
      ...mockOneOffEvents,
    ]) {
      expect(accountIds.has(item.accountId)).toBe(true);
    }

    expect(accountIds.has(mockUserProfile.primaryAccountId)).toBe(true);
  });

  it("names exactly one primary account", () => {
    expect(mockAccounts.filter((account) => account.isPrimary)).toHaveLength(1);
  });
});

describe("history and forecast do not overlap", () => {
  it("dates every transaction before the reference date", () => {
    for (const transaction of mockTransactions) {
      expect(transaction.date < DEMO_REFERENCE_DATE).toBe(true);
    }
  });

  it("dates every one-off event after the reference date", () => {
    for (const event of mockOneOffEvents) {
      expect(event.date > DEMO_REFERENCE_DATE).toBe(true);
    }
  });

  it("sorts transactions newest first", () => {
    for (let index = 1; index < mockTransactions.length; index += 1) {
      expect(
        mockTransactions[index - 1].date >= mockTransactions[index].date,
      ).toBe(true);
    }
  });
});

describe("categories stay consistent with the spending breakdown", () => {
  it("categorises every debit as one of the seven spending categories", () => {
    const spendingCategories = new Set<string>(SPENDING_CATEGORIES);

    for (const transaction of mockTransactions) {
      if (transaction.type !== "debit") continue;

      expect(
        spendingCategories.has(transaction.category),
        `${transaction.id} (${transaction.merchant}) uses "${transaction.category}", which the spending breakdown would drop`,
      ).toBe(true);
    }
  });

  it("categorises every credit as income", () => {
    for (const transaction of mockTransactions) {
      if (transaction.type !== "credit") continue;

      expect(transaction.category).toBe("Income");
    }
  });

  it("fills every slice of the primary account's donut", () => {
    const summary = summarizeSpending({
      accountId: PRIMARY_ACCOUNT_ID,
      transactions: mockTransactions,
      periodEnd: DEMO_REFERENCE_DATE,
      periodDays: SPENDING_PERIOD_DAYS,
    });

    expect(summary.categories.map((entry) => entry.category).sort()).toEqual(
      [...SPENDING_CATEGORIES].sort(),
    );
  });
});

describe("recurring schedules reconcile with the transaction history", () => {
  const earliestTransaction = mockTransactions.reduce(
    (earliest, transaction) =>
      transaction.date < earliest ? transaction.date : earliest,
    DEMO_REFERENCE_DATE,
  );

  const recurringItems = [
    ...mockBills.map((bill) => ({
      kind: "bill" as const,
      id: bill.id,
      accountId: bill.accountId,
      amount: bill.amount,
      anchorDate: bill.anchorDate,
      confidence: bill.confidence,
    })),
    ...mockIncomeSources.map((source) => ({
      kind: "income" as const,
      id: source.id,
      accountId: source.accountId,
      amount: source.amount,
      anchorDate: source.anchorDate,
      confidence: source.confidence,
    })),
  ];

  it("backs every scheduled anchor inside the history window with a real transaction", () => {
    for (const item of recurringItems) {
      if (item.confidence !== "scheduled") continue;
      if (item.anchorDate > DEMO_REFERENCE_DATE) continue;
      if (item.anchorDate < earliestTransaction) continue;

      const match = mockTransactions.find(
        (transaction) =>
          transaction.accountId === item.accountId &&
          transaction.date === item.anchorDate &&
          transaction.amount === item.amount,
      );

      expect(
        match,
        `${item.kind} "${item.id}" is anchored on ${item.anchorDate} but no transaction of ${item.amount} exists on that date`,
      ).toBeDefined();
    }
  });
});

describe("documented headline figures", () => {
  it("keeps the primary account at the documented balance and settings", () => {
    const primary = mockAccounts.find(
      (account) => account.id === PRIMARY_ACCOUNT_ID,
    );

    expect(primary?.currentBalance).toBe(2143);
    expect(primary?.type).toBe("checking");
    expect(DEFAULT_PREFERENCES.minimumProtectedBalance).toBe(300);
    expect(DEFAULT_PREFERENCES.targetConfidence).toBe(95);
    expect(DEFAULT_PREFERENCES.forecastHorizonDays).toBe(90);
  });

  it("produces the simulated figures quoted in the README", () => {
    const input = buildSimulationInput({
      dataset: demoDataset,
      accountId: PRIMARY_ACCOUNT_ID,
      protectedMinimumCents: DEFAULT_PREFERENCES.minimumProtectedBalance * 100,
      targetConfidence: DEFAULT_PREFERENCES.targetConfidence / 100,
      horizonDays: DEFAULT_PREFERENCES.forecastHorizonDays,
      emergenciesEnabled: createDemoProfile(DEMO_REFERENCE_DATE).emergencies.enabled,
    });
    const runtime = createSimulationRuntime();
    const result = runtime.run(input);
    const [playStation] = runtime.compare(input, [
      {
        id: "playstation",
        type: "one_time_purchase",
        amountCents: 60_000,
        effectiveDate: DEMO_REFERENCE_DATE,
        frequency: null,
        description: "PlayStation",
      },
    ]).scenarios;

    expect(result.pathCount).toBe(10_000);
    expect(result.safety.safetyProbability).toBe(0.9781);
    expect(result.safeToSpend.amountCents).toBe(52_324);
    expect(playStation.safety.safetyProbability).toBe(0.9438);
    expect(playStation.meetsTarget).toBe(false);
  });
});
