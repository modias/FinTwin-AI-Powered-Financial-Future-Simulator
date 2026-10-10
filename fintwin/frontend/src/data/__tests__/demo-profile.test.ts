import { describe, expect, it } from "vitest";

import { PRIMARY_ACCOUNT_ID, mockAccounts } from "@/data/mock-accounts";
import { mockBills, mockIncomeSources, mockOneOffEvents } from "@/data/mock-events";
import { createDemoProfile, demoDataset } from "@/data/demo-profile";
import { DEMO_REFERENCE_DATE } from "@/lib/constants";
import { centsToDollars } from "@/lib/money";
import { financialProfileSchema } from "@/lib/profile/schemas";
import { datasetForProfile } from "@/lib/profile/dataset";

const profile = createDemoProfile("2026-10-12T15:00:00.000Z");
const primaryBills = mockBills.filter((bill) => bill.accountId === PRIMARY_ACCOUNT_ID);
const dayOf = (date: string) => Number(date.slice(8, 10));

describe("demo profile", () => {
  it("is a valid profile", () => {
    expect(financialProfileSchema.parse(profile)).toEqual(profile);
  });

  it("resolves to the full seeded dataset, not a profile-built one", () => {
    expect(datasetForProfile(profile)).toBe(demoDataset);
    expect(demoDataset.accounts).toEqual(mockAccounts);
  });

  it("matches the primary account's balance, rent and paycheck", () => {
    const account = mockAccounts.find((candidate) => candidate.id === PRIMARY_ACCOUNT_ID)!;
    const rent = primaryBills.find((bill) => bill.category === "Housing")!;
    const paycheck = mockIncomeSources.find((source) => source.accountId === PRIMARY_ACCOUNT_ID)!;

    expect(centsToDollars(profile.account.balanceCents)).toBe(account.currentBalance);
    expect(profile.account.balanceAsOf).toBe(DEMO_REFERENCE_DATE);
    expect(centsToDollars(profile.housing.amountCents)).toBe(rent.amount);
    expect(profile.housing.dueDay).toBe(dayOf(rent.anchorDate));
    expect(profile.income).toMatchObject({
      frequency: paycheck.cadence,
      paycheckAmountCents: paycheck.amount * 100,
    });
  });

  it("has a matching mock bill for every monthly bill", () => {
    for (const bill of profile.recurringBills) {
      if (bill.frequency !== "monthly") continue;

      const match = primaryBills.find((candidate) => candidate.name === bill.name);

      expect(match, bill.name).toBeDefined();
      expect(centsToDollars(bill.amountCents)).toBe(match!.amount);
      expect(bill.dueDay).toBe(dayOf(match!.anchorDate));
    }
  });

  it("has a matching mock event for every one-time bill", () => {
    for (const bill of profile.recurringBills) {
      if (bill.frequency !== "one_time") continue;

      const match = mockOneOffEvents.find((event) => event.name === bill.name);

      expect(match, bill.name).toMatchObject({
        accountId: PRIMARY_ACCOUNT_ID,
        amount: centsToDollars(bill.amountCents),
        date: bill.nextDueDate,
      });
    }
  });

  it("matches the dataset's estimated spending", () => {
    const estimated = primaryBills.filter((bill) => bill.confidence === "estimated");
    const weeklyMockCents = estimated.reduce(
      (sum, bill) => sum + (bill.cadence === "biweekly" ? bill.amount * 50 : bill.amount * 100),
      0,
    );
    const weeklyProfileCents = Object.values(profile.variableSpending.amountsCents).reduce(
      (sum, cents) => sum + cents,
      0,
    );

    expect(profile.variableSpending.period).toBe("weekly");
    expect(weeklyProfileCents).toBe(weeklyMockCents);
  });
});
