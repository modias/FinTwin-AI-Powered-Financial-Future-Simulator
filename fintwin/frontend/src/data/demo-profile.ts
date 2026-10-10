/**
 * The demo profile and the dataset it resolves to.
 *
 * "Try with Demo Data" activates this profile. Its dashboard is served by the
 * seeded mock dataset — both demo accounts and the full transaction history —
 * rather than by `profileToDataset`, so the demo keeps everything it had
 * before onboarding existed.
 *
 * The profile's answers describe the same obligations as Alex's Everyday
 * Checking account (the test suite checks that they agree), so opening the
 * demo answers in the questionnaire shows figures consistent with the demo
 * dashboard. Everyday spending covers what the mock dataset forecasts —
 * groceries and fuel — and unexpected expenses are off because the mock
 * dataset does not model them.
 */

import { PRIMARY_ACCOUNT_ID, mockAccounts, mockUserProfile } from "@/data/mock-accounts";
import { mockBills, mockIncomeSources, mockOneOffEvents } from "@/data/mock-events";
import { mockTransactions } from "@/data/mock-transactions";
import { forwardWindow } from "@/lib/calculations";
import { DEFAULT_PREFERENCES, DEMO_REFERENCE_DATE } from "@/lib/constants";
import { occurrencesBetween } from "@/lib/dates";
import { dollarsToCents } from "@/lib/money";
import type { FinancialDataset } from "@/types/financial";
import type { FinancialProfile } from "@/types/profile";

export const DEMO_PROFILE_ID = "demo_alex_morgan";
export const DEMO_DATASET_KEY = "demo:alex-morgan";

export const demoDataset: FinancialDataset = {
  key: DEMO_DATASET_KEY,
  source: "demo",
  referenceDate: DEMO_REFERENCE_DATE,
  user: mockUserProfile,
  accounts: mockAccounts,
  transactions: mockTransactions,
  bills: mockBills,
  incomeSources: mockIncomeSources,
  oneOffEvents: mockOneOffEvents,
  spendingEstimates: null,
};

function primaryAccountBalanceCents(): number {
  const account = mockAccounts.find((candidate) => candidate.id === PRIMARY_ACCOUNT_ID);

  if (!account) throw new Error("Demo dataset is missing its primary account");

  return dollarsToCents(account.currentBalance);
}

function nextDemoPayday(): string {
  const paycheck = mockIncomeSources.find((source) => source.id === "inc_ec_paycheck");

  if (!paycheck) throw new Error("Demo dataset is missing its paycheck");

  const { start, end } = forwardWindow(DEMO_REFERENCE_DATE, 14);

  return occurrencesBetween(paycheck.anchorDate, paycheck.cadence, start, end)[0];
}

/** `now` is an ISO timestamp, recorded as when the demo was loaded. */
export function createDemoProfile(now: string): FinancialProfile {
  return {
    schemaVersion: 1,
    id: DEMO_PROFILE_ID,
    source: "demo",
    account: {
      balanceCents: primaryAccountBalanceCents(),
      currency: "USD",
      balanceAsOf: DEMO_REFERENCE_DATE,
    },
    income: {
      frequency: "biweekly",
      paycheckAmountCents: 150_000,
      nextPayday: nextDemoPayday(),
    },
    housing: { amountCents: 85_000, dueDay: 1 },
    recurringBills: [
      { id: "demo_phone", name: "Phone bill", category: "phone", amountCents: 7_500, frequency: "monthly", dueDay: 8 },
      { id: "demo_utilities", name: "Utilities", category: "utilities", amountCents: 8_000, frequency: "monthly", dueDay: 14 },
      { id: "demo_internet", name: "Home internet", category: "internet", amountCents: 6_500, frequency: "monthly", dueDay: 18 },
      { id: "demo_netflix", name: "Netflix", category: "subscriptions", amountCents: 1_599, frequency: "monthly", dueDay: 22 },
      { id: "demo_gym", name: "Planet Fitness", category: "subscriptions", amountCents: 2_900, frequency: "monthly", dueDay: 28 },
      { id: "demo_spotify", name: "Spotify", category: "subscriptions", amountCents: 1_199, frequency: "monthly", dueDay: 2 },
      { id: "demo_dental", name: "Dental cleaning", category: "healthcare", amountCents: 9_500, frequency: "one_time", nextDueDate: "2026-11-13" },
      { id: "demo_registration", name: "Car registration renewal", category: "other", amountCents: 18_600, frequency: "one_time", nextDueDate: "2026-11-20" },
      { id: "demo_renters_insurance", name: "Renters insurance (annual)", category: "insurance", amountCents: 28_500, frequency: "one_time", nextDueDate: "2026-12-27" },
    ],
    variableSpending: {
      period: "weekly",
      amountsCents: {
        groceries: 10_000,
        transportation: 3_000,
        dining: 0,
        shopping: 0,
        entertainment: 0,
        personal_care: 0,
        other: 0,
      },
    },
    emergencies: { enabled: false },
    preferences: {
      protectedMinimumCents: dollarsToCents(DEFAULT_PREFERENCES.minimumProtectedBalance),
      targetConfidence: 0.95,
      horizonDays: DEFAULT_PREFERENCES.forecastHorizonDays,
    },
    completedAt: now,
    updatedAt: now,
  };
}
