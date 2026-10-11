/**
 * Zod schemas for every value that crosses a trust boundary.
 *
 * Two boundaries exist today:
 *  - `localStorage`, which can hold data written by an older build.
 *  - the future FastAPI backend, which the HTTP service will validate before
 *    handing payloads to the UI.
 *
 * Each schema is checked against the hand-written domain types with
 * `satisfies`, so a change to one side fails to compile rather than drifting.
 */

import { z } from "zod";

import {
  FORECAST_HORIZONS,
  TARGET_CONFIDENCES,
  THEME_PREFERENCES,
} from "@/lib/constants";
import {
  TRANSACTION_CATEGORIES,
  type Account,
  type Bill,
  type CashFlowEvent,
  type CategorySpend,
  type FinancialSummary,
  type IncomeSource,
  type SpendingSummary,
  type Transaction,
  type UserPreferences,
  type UserProfile,
} from "@/types/financial";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const money = z.number().finite().nonnegative();

export const transactionCategorySchema = z.enum(TRANSACTION_CATEGORIES);
export const cadenceSchema = z.enum(["weekly", "biweekly", "monthly"]);
export const eventConfidenceSchema = z.enum(["scheduled", "estimated"]);
export const spendingKindSchema = z.enum(["essential", "discretionary", "unexpected"]);

export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  institution: z.string().min(1),
  type: z.enum(["checking", "savings"]),
  mask: z.string().regex(/^\d{4}$/).nullable(),
  currentBalance: z.number().finite(),
  currency: z.literal("USD"),
  isPrimary: z.boolean(),
}) satisfies z.ZodType<Account>;

export const transactionSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  merchant: z.string().min(1),
  category: transactionCategorySchema,
  amount: money,
  date: isoDate,
  type: z.enum(["debit", "credit"]),
  description: z.string().min(1),
}) satisfies z.ZodType<Transaction>;

export const billSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  name: z.string().min(1),
  category: transactionCategorySchema,
  amount: money,
  cadence: cadenceSchema,
  anchorDate: isoDate,
  confidence: eventConfidenceSchema,
  autoPay: z.boolean(),
  spendingKind: spendingKindSchema.optional(),
}) satisfies z.ZodType<Bill>;

export const incomeSourceSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  name: z.string().min(1),
  payer: z.string().min(1),
  amount: money,
  cadence: cadenceSchema,
  anchorDate: isoDate,
  confidence: eventConfidenceSchema,
}) satisfies z.ZodType<IncomeSource>;

export const cashFlowEventSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  name: z.string().min(1),
  category: transactionCategorySchema,
  amount: money,
  date: isoDate,
  direction: z.enum(["income", "expense"]),
  confidence: eventConfidenceSchema,
  sourceId: z.string().min(1),
  spendingKind: spendingKindSchema.optional(),
}) satisfies z.ZodType<CashFlowEvent>;

export const categorySpendSchema = z.object({
  category: transactionCategorySchema,
  total: z.number().finite(),
  percentage: z.number().finite(),
  transactionCount: z.number().int().nonnegative(),
}) satisfies z.ZodType<CategorySpend>;

export const spendingSummarySchema = z.object({
  accountId: z.string().min(1),
  basis: z.enum(["transactions", "estimates"]),
  periodStart: isoDate,
  periodEnd: isoDate,
  periodDays: z.number().int().positive(),
  total: z.number().finite(),
  categories: z.array(categorySpendSchema),
  topCategory: categorySpendSchema.nullable(),
  transactionCount: z.number().int().nonnegative(),
}) satisfies z.ZodType<SpendingSummary>;

export const financialSummarySchema = z.object({
  accountId: z.string().min(1),
  referenceDate: isoDate,
  currentBalance: z.number().finite(),
  protectedMinimumBalance: z.number().finite(),
  upcomingBillsTotal: z.number().finite(),
  upcomingBillsCount: z.number().int().nonnegative(),
  upcomingWindowDays: z.number().int().positive(),
  expectedIncomeTotal: z.number().finite(),
  nextIncomeDate: isoDate.nullable(),
  nextIncomeAmount: z.number().finite().nullable(),
}) satisfies z.ZodType<FinancialSummary>;

export const userProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).nullable(),
  email: z.email().nullable(),
  initials: z.string().min(1).nullable(),
  accountType: z.enum(["checking", "savings"]),
  primaryAccountId: z.string().min(1),
}) satisfies z.ZodType<UserProfile>;

export const userPreferencesSchema = z.object({
  minimumProtectedBalance: z.number().finite().min(0).max(100_000),
  targetConfidence: z.union([
    z.literal(TARGET_CONFIDENCES[0]),
    z.literal(TARGET_CONFIDENCES[1]),
    z.literal(TARGET_CONFIDENCES[2]),
  ]),
  forecastHorizonDays: z.union([
    z.literal(FORECAST_HORIZONS[0]),
    z.literal(FORECAST_HORIZONS[1]),
    z.literal(FORECAST_HORIZONS[2]),
  ]),
  theme: z.enum(THEME_PREFERENCES),
}) satisfies z.ZodType<UserPreferences>;

export const themePreferenceSchema = z.enum(THEME_PREFERENCES);
