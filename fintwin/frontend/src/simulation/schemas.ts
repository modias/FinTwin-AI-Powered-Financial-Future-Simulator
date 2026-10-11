/**
 * Zod schemas for what enters the engine from outside: scenarios typed into
 * a form, and the input posted to the worker.
 */

import { z } from "zod";

import { FORECAST_HORIZONS, MAX_AMOUNT_CENTS } from "@/lib/constants";
import { isValidIsoDate } from "@/lib/dates";
import { transactionCategorySchema } from "@/lib/schemas";
import {
  SCENARIO_FREQUENCIES,
  SCENARIO_TYPES,
  type FinancialScenario,
  type SimulationInput,
} from "@/simulation/types";

const isoDate = z.string().refine(isValidIsoDate, "Expected a real YYYY-MM-DD date");
const cents = z.number().int().safe();
const positiveCents = cents.positive().max(MAX_AMOUNT_CENTS);
const variation = z.number().finite().min(0).max(5);

export const financialScenarioSchema = z
  .object({
    id: z.string().min(1).max(64),
    type: z.enum(SCENARIO_TYPES),
    amountCents: positiveCents,
    effectiveDate: isoDate,
    frequency: z.enum(SCENARIO_FREQUENCIES).nullable(),
    description: z.string().trim().max(120),
  })
  .superRefine((scenario, context) => {
    if (scenario.type === "recurring_expense" && scenario.frequency === null) {
      context.addIssue({
        code: "custom",
        path: ["frequency"],
        message: "Choose how often this expense repeats.",
      });
    }

    if (scenario.type !== "recurring_expense" && scenario.frequency !== null) {
      context.addIssue({
        code: "custom",
        path: ["frequency"],
        message: "Only recurring expenses have a frequency.",
      });
    }
  }) satisfies z.ZodType<FinancialScenario>;

const timelineEventSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  name: z.string().min(1),
  category: transactionCategorySchema,
  date: isoDate,
  dayIndex: z.number().int().positive(),
  amountCents: cents.nonnegative(),
  direction: z.enum(["income", "expense"]),
  confidence: z.enum(["scheduled", "estimated"]),
  recurring: z.boolean(),
});

const kindAssumptionsSchema = z.object({
  kind: z.enum(["essential", "discretionary"]),
  basis: z.enum(["transaction_history", "fallback"]),
  weeklyVariation: variation,
  levelVariation: variation,
  history: z
    .object({
      weeks: z.number().int().positive(),
      transactions: z.number().int().positive(),
      weeklyMeanCents: cents.nonnegative(),
    })
    .nullable(),
});

export const simulationInputSchema = z.object({
  fingerprint: z.string().min(1),
  pathsKey: z.string().min(1),
  datasetKey: z.string().min(1),
  dataSource: z.enum(["demo", "user_entered"]),
  accountId: z.string().min(1),
  referenceDate: isoDate,
  horizonDays: z.union(FORECAST_HORIZONS.map((days) => z.literal(days))),
  openingBalanceCents: cents,
  protectedMinimumCents: cents.nonnegative(),
  targetConfidence: z.union([z.literal(0.9), z.literal(0.95), z.literal(0.99)]),
  pathCount: z.number().int().min(1).max(50_000),
  seed: z.number().int().nonnegative().max(0xffffffff),
  scheduledIncome: z.array(timelineEventSchema),
  scheduledBills: z.array(timelineEventSchema),
  variableSpending: z.array(
    z.object({
      id: z.string().min(1),
      sourceId: z.string().min(1),
      name: z.string().min(1),
      date: isoDate,
      dayIndex: z.number().int().positive(),
      kind: z.enum(["essential", "discretionary"]),
      expectedCents: cents.nonnegative(),
      variation,
      basis: z.enum(["estimate", "transaction_history"]),
    }),
  ),
  spendingModel: z.object({
    distribution: z.literal("lognormal"),
    essential: kindAssumptionsSchema,
    discretionary: kindAssumptionsSchema,
  }),
  emergencies: z
    .object({
      basis: z.literal("assumption"),
      eventsPerYear: z.number().finite().min(0).max(365),
      meanCostCents: cents.nonnegative(),
      costVariation: variation,
      maxCostCents: cents.positive(),
    })
    .nullable(),
  warnings: z.array(
    z.object({
      code: z.enum([
        "limited_history",
        "below_minimum_today",
        "no_income_in_horizon",
        "estimated_income",
      ]),
      message: z.string().min(1),
    }),
  ),
}) satisfies z.ZodType<SimulationInput>;
