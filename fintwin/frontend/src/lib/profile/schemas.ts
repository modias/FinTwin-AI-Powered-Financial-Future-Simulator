/**
 * Zod schemas for the onboarding profile and draft.
 *
 * These guard `localStorage`: anything stored by an older build, edited by
 * hand or truncated mid-write fails to parse and is discarded instead of
 * reaching the forecast. Each schema is tied to its TypeScript type with
 * `satisfies`, so the two cannot drift.
 */

import { z } from "zod";

import { FORECAST_HORIZONS, MAX_AMOUNT_CENTS } from "@/lib/constants";
import { isValidIsoDate } from "@/lib/dates";
import {
  BILL_CATEGORIES,
  PAY_FREQUENCIES,
  PROFILE_CONFIDENCES,
  VARIABLE_SPENDING_CATEGORIES,
  type ExpectedPayment,
  type FinancialProfile,
  type OnboardingDraft,
  type ProfileBill,
  type ProfileIncome,
  type ProfilePreferences,
  type ProfileVariableSpending,
  type VariableSpendingCategory,
} from "@/types/profile";

export const calendarDateSchema = z
  .string()
  .refine(isValidIsoDate, "Expected a real calendar date (YYYY-MM-DD)");

export const centsSchema = z.number().int().min(0).max(MAX_AMOUNT_CENTS);

export const dayOfMonthSchema = z.number().int().min(1).max(31);

const dayPairSchema = z.tuple([dayOfMonthSchema, dayOfMonthSchema]);

const horizonSchema = z.union([
  z.literal(FORECAST_HORIZONS[0]),
  z.literal(FORECAST_HORIZONS[1]),
  z.literal(FORECAST_HORIZONS[2]),
]);

const confidenceSchema = z.union([
  z.literal(PROFILE_CONFIDENCES[0]),
  z.literal(PROFILE_CONFIDENCES[1]),
  z.literal(PROFILE_CONFIDENCES[2]),
]);

export const expectedPaymentSchema = z.object({
  id: z.string().min(1),
  date: calendarDateSchema,
  amountCents: centsSchema.min(1),
}) satisfies z.ZodType<ExpectedPayment>;

export const profileIncomeSchema = z.discriminatedUnion("frequency", [
  z.object({
    frequency: z.enum(["weekly", "biweekly", "monthly"]),
    paycheckAmountCents: centsSchema.min(1),
    nextPayday: calendarDateSchema,
  }),
  z.object({
    frequency: z.literal("semimonthly"),
    paycheckAmountCents: centsSchema.min(1),
    semimonthlyPaydays: dayPairSchema.refine(
      ([first, second]) => first !== second,
      "The two paydays must be different days",
    ),
  }),
  z.object({
    frequency: z.literal("irregular"),
    paycheckAmountCents: centsSchema,
    expectedPayments: z.array(expectedPaymentSchema).max(24),
  }),
  z.object({
    frequency: z.literal("none"),
    paycheckAmountCents: z.literal(0),
  }),
]) satisfies z.ZodType<ProfileIncome>;

const billBase = {
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  category: z.enum(BILL_CATEGORIES),
  amountCents: centsSchema.min(1),
};

export const profileBillSchema = z.discriminatedUnion("frequency", [
  z.object({
    ...billBase,
    frequency: z.enum(["weekly", "biweekly", "one_time"]),
    nextDueDate: calendarDateSchema,
  }),
  z.object({
    ...billBase,
    frequency: z.literal("monthly"),
    dueDay: dayOfMonthSchema,
  }),
  z.object({
    ...billBase,
    frequency: z.literal("semimonthly"),
    dueDays: dayPairSchema.refine(
      ([first, second]) => first !== second,
      "The two due days must be different days",
    ),
  }),
]) satisfies z.ZodType<ProfileBill>;

function amountsRecord<T extends z.ZodType>(value: T) {
  return z.object(
    Object.fromEntries(
      VARIABLE_SPENDING_CATEGORIES.map((category) => [category, value]),
    ) as Record<VariableSpendingCategory, T>,
  );
}

export const variableSpendingSchema = z.object({
  period: z.enum(["weekly", "monthly"]),
  amountsCents: amountsRecord(centsSchema),
}) satisfies z.ZodType<ProfileVariableSpending>;

export const profilePreferencesSchema = z.object({
  protectedMinimumCents: centsSchema,
  targetConfidence: confidenceSchema,
  horizonDays: horizonSchema,
}) satisfies z.ZodType<ProfilePreferences>;

export const financialProfileSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    source: z.enum(["user_entered", "demo"]),
    account: z.object({
      balanceCents: centsSchema,
      currency: z.literal("USD"),
      balanceAsOf: calendarDateSchema,
    }),
    income: profileIncomeSchema,
    housing: z.object({
      amountCents: centsSchema,
      dueDay: dayOfMonthSchema.nullable(),
    }),
    recurringBills: z.array(profileBillSchema).max(50),
    variableSpending: variableSpendingSchema,
    emergencies: z.object({ enabled: z.boolean() }),
    preferences: profilePreferencesSchema,
    completedAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .refine(
    (profile) =>
      profile.housing.amountCents === 0
        ? profile.housing.dueDay === null
        : profile.housing.dueDay !== null,
    { message: "Housing needs a due day exactly when it has an amount", path: ["housing"] },
  ) satisfies z.ZodType<FinancialProfile>;

export const onboardingDraftSchema = z.object({
  schemaVersion: z.literal(1),
  step: z.number().int().min(0).max(3),
  basedOn: z.enum(["blank", "personal", "demo"]),
  reviewed: z.boolean(),
  balanceCents: centsSchema.nullable(),
  paycheckAmountCents: centsSchema.nullable(),
  payFrequency: z.enum(PAY_FREQUENCIES).nullable(),
  nextPayday: calendarDateSchema.nullable(),
  semimonthlyPaydays: z.tuple([
    dayOfMonthSchema.nullable(),
    dayOfMonthSchema.nullable(),
  ]),
  expectedPayments: z.array(expectedPaymentSchema).max(24),
  noHousingPayment: z.boolean(),
  housingAmountCents: centsSchema.nullable(),
  housingDueDay: dayOfMonthSchema.nullable(),
  bills: z.array(profileBillSchema).max(50),
  spendingPeriod: z.enum(["weekly", "monthly"]),
  spendingCents: amountsRecord(centsSchema.nullable()),
  emergenciesEnabled: z.boolean(),
  protectedMinimumCents: centsSchema.nullable(),
  targetConfidence: confidenceSchema,
  horizonDays: horizonSchema,
}) satisfies z.ZodType<OnboardingDraft>;
