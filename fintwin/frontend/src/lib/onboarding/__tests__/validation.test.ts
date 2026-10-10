import { describe, expect, it } from "vitest";

import { TODAY, NOW, makeProfile, makeValidDraft } from "@/lib/profile/__tests__/fixtures";
import {
  createEmptyDraft,
  draftFromProfile,
  draftToProfile,
} from "@/lib/onboarding/draft";
import {
  firstInvalidStep,
  validateDraft,
  validateStep,
} from "@/lib/onboarding/validation";
import type { OnboardingDraft } from "@/types/profile";

const errorKeys = (draft: OnboardingDraft, step: number) =>
  Object.keys(validateStep(draft, step, TODAY)).sort();

describe("required answers", () => {
  it("blocks an empty income step on the balance, paycheck and pay schedule", () => {
    expect(errorKeys(createEmptyDraft(), 0)).toEqual(["balance", "payFrequency", "paycheckAmount"]);
  });

  it("asks for the amount and next payday once a schedule is chosen", () => {
    expect(errorKeys(makeValidDraft({ paycheckAmountCents: null, nextPayday: null }), 0)).toEqual([
      "nextPayday",
      "paycheckAmount",
    ]);
  });

  it("accepts a $0 balance", () => {
    expect(errorKeys(makeValidDraft({ balanceCents: 0 }), 0)).toEqual([]);
  });

  it("requires the next payday to be after today and within one pay cycle", () => {
    const payday = (frequency: "weekly" | "biweekly" | "monthly", nextPayday: string) =>
      validateStep(makeValidDraft({ payFrequency: frequency, nextPayday }), 0, TODAY).nextPayday;

    expect(payday("biweekly", TODAY)).toMatch(/after today/);
    expect(payday("weekly", "2026-10-19")).toBeUndefined();
    expect(payday("weekly", "2026-10-20")).toMatch(/7 days/);
    expect(payday("biweekly", "2026-10-26")).toBeUndefined();
    expect(payday("biweekly", "2026-10-27")).toMatch(/14 days/);
    expect(payday("monthly", "2026-11-12")).toBeUndefined();
    expect(payday("monthly", "2026-11-13")).toMatch(/31 days/);
  });

  it("needs two different days for twice-monthly pay, and no payday date", () => {
    const base = makeValidDraft({ payFrequency: "semimonthly", nextPayday: null });

    expect(errorKeys({ ...base, semimonthlyPaydays: [1, null] }, 0)).toEqual(["semimonthlyPaydays"]);
    expect(errorKeys({ ...base, semimonthlyPaydays: [15, 15] }, 0)).toEqual(["semimonthlyPaydays"]);
    expect(errorKeys({ ...base, semimonthlyPaydays: [1, 15] }, 0)).toEqual([]);
  });

  it("allows no regular income with a $0 paycheck, and irregular income with no listed payments", () => {
    expect(
      errorKeys(makeValidDraft({ payFrequency: "none", paycheckAmountCents: 0, nextPayday: null }), 0),
    ).toEqual([]);
    expect(
      errorKeys(makeValidDraft({ payFrequency: "none", paycheckAmountCents: 50_000 }), 0),
    ).toEqual(["paycheckAmount"]);
    expect(
      errorKeys(makeValidDraft({ payFrequency: "irregular", paycheckAmountCents: null, nextPayday: null }), 0),
    ).toEqual([]);
  });

  it("rejects a $0 paycheck on a regular schedule", () => {
    expect(errorKeys(makeValidDraft({ paycheckAmountCents: 0 }), 0)).toEqual(["paycheckAmount"]);
  });

  it("requires a housing answer, and a due day when there is rent", () => {
    expect(errorKeys(createEmptyDraft(), 1)).toEqual(["housingAmount"]);
    expect(errorKeys(makeValidDraft({ housingDueDay: null }), 1)).toEqual(["housingDueDay"]);
    expect(
      errorKeys(makeValidDraft({ noHousingPayment: true, housingAmountCents: null, housingDueDay: null }), 1),
    ).toEqual([]);
  });

  it("lets everyday spending be skipped", () => {
    expect(errorKeys(createEmptyDraft(), 2)).toEqual([]);
  });

  it("requires a protected minimum, which may be $0", () => {
    expect(errorKeys(makeValidDraft({ protectedMinimumCents: null }), 3)).toEqual(["protectedMinimum"]);
    expect(errorKeys(makeValidDraft({ protectedMinimumCents: 0 }), 3)).toEqual([]);
  });

  it("reports the first step that needs attention", () => {
    expect(firstInvalidStep(createEmptyDraft(), TODAY)).toBe(0);
    expect(firstInvalidStep(makeValidDraft({ housingAmountCents: null }), TODAY)).toBe(1);
    expect(firstInvalidStep(makeValidDraft({ protectedMinimumCents: null }), TODAY)).toBe(3);
    expect(firstInvalidStep(makeValidDraft(), TODAY)).toBeNull();
  });

  it("catches answers that went stale after they were saved", () => {
    const draft = makeValidDraft({ nextPayday: "2026-10-16" });

    expect(validateDraft(draft, "2026-10-16")[0]).toHaveProperty("nextPayday");
  });
});

describe("draftToProfile", () => {
  it("returns the step to fix instead of a profile when anything is missing", () => {
    expect(
      draftToProfile(makeValidDraft({ housingAmountCents: null }), { today: TODAY, now: NOW, existing: null }),
    ).toEqual({ ok: false, step: 1 });
  });

  it("builds a valid profile in cents with the balance dated today", () => {
    const result = draftToProfile(
      makeValidDraft({
        spendingPeriod: "weekly",
        spendingCents: { ...createEmptyDraft().spendingCents, groceries: 9_000 },
        protectedMinimumCents: 50_000,
        targetConfidence: 0.99,
        horizonDays: 60,
      }),
      { today: TODAY, now: NOW, existing: null },
    );

    expect(result.ok).toBe(true);

    if (!result.ok) return;

    expect(result.profile).toMatchObject({
      source: "user_entered",
      account: { balanceCents: 200_000, balanceAsOf: TODAY },
      income: { frequency: "biweekly", paycheckAmountCents: 150_000, nextPayday: "2026-10-16" },
      housing: { amountCents: 120_000, dueDay: 1 },
      variableSpending: { period: "weekly", amountsCents: { groceries: 9_000, dining: 0 } },
      emergencies: { enabled: true },
      preferences: { protectedMinimumCents: 50_000, targetConfidence: 0.99, horizonDays: 60 },
      completedAt: NOW,
    });
  });

  it("stores no housing when the user has none, whatever was typed before", () => {
    const result = draftToProfile(
      makeValidDraft({ noHousingPayment: true, housingAmountCents: 120_000, housingDueDay: 1 }),
      { today: TODAY, now: NOW, existing: null },
    );

    expect(result.ok && result.profile.housing).toEqual({ amountCents: 0, dueDay: null });
  });

  it("keeps the edited profile's id and creation time", () => {
    const existing = makeProfile({ id: "profile_keep", completedAt: "2026-09-01T00:00:00.000Z" });
    const result = draftToProfile(draftFromProfile(existing), {
      today: TODAY,
      now: NOW,
      existing,
    });

    expect(result.ok && result.profile).toMatchObject({
      id: "profile_keep",
      completedAt: "2026-09-01T00:00:00.000Z",
      updatedAt: NOW,
    });
  });

  it("round-trips a profile through the questionnaire unchanged", () => {
    const profile = makeProfile();
    const result = draftToProfile(draftFromProfile(profile), { today: TODAY, now: NOW, existing: profile });

    expect(result).toEqual({ ok: true, profile });
  });
});
