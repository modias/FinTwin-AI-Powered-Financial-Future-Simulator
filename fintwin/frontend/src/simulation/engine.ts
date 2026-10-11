/**
 * The Monte Carlo engine: simulate paths once, then answer questions about
 * them.
 *
 * `createSimulationRuntime` keeps recently simulated paths keyed by
 * `pathsKey`, so changing the protected minimum or the safety target — which
 * don't change a single random draw — re-summarises cached paths instead of
 * simulating again, and every what-if scenario is evaluated on exactly the
 * baseline's paths.
 */

import { addDays, formatMediumDate } from "@/lib/dates";
import { formatProbability as percent } from "@/lib/formatters";
import { formatCents } from "@/lib/money";
import { dailySchedule, postOpeningMinimum, simulatePaths, type DailySchedule } from "@/simulation/cashflow";
import { countSafePaths, optimizeSafeToSpend } from "@/simulation/optimizer";
import { dailyPercentiles, quantileSorted, sortedCopy, type DailyPercentiles } from "@/simulation/percentiles";
import {
  cumulativeChange,
  scenarioCashFlows,
  scenarioIssues,
} from "@/simulation/scenarios";
import type {
  FinancialScenario,
  ForecastBand,
  RiskDriver,
  RiskMetrics,
  SafetyMetrics,
  ScenarioComparison,
  ScenarioResult,
  SimulatedPaths,
  SimulationInput,
  SimulationResult,
  TimelineTotals,
} from "@/simulation/types";

/** Paths plus everything derived from them that doesn't depend on the minimum or target. */
interface PathSet {
  paths: SimulatedPaths;
  schedule: DailySchedule;
  percentiles: DailyPercentiles;
  /** Baseline per-path lowest checkpoint after the opening balance. */
  postOpeningMinimum: Float64Array;
}

function buildPathSet(input: SimulationInput): PathSet {
  const paths = simulatePaths(input);

  return {
    paths,
    schedule: dailySchedule(input),
    percentiles: dailyPercentiles(paths),
    postOpeningMinimum: postOpeningMinimum(paths),
  };
}

function safetyMetrics(
  paths: SimulatedPaths,
  postOpeningMin: Float64Array,
  protectedMinimumCents: number,
  endingShiftCents = 0,
): SafetyMetrics {
  const { pathCount, dayCount, closing, openingBalanceCents } = paths;
  const safePaths = countSafePaths(openingBalanceCents, postOpeningMin, protectedMinimumCents);
  const lastDay = (dayCount - 1) * pathCount;
  let endingAbove = 0;

  for (let path = 0; path < pathCount; path += 1) {
    if (closing[lastDay + path] + endingShiftCents >= protectedMinimumCents) endingAbove += 1;
  }

  return {
    safePaths,
    pathCount,
    safetyProbability: safePaths / pathCount,
    breachProbability: (pathCount - safePaths) / pathCount,
    endingAboveMinimumProbability: endingAbove / pathCount,
  };
}

/** Each path's lowest balance at any checkpoint, including the opening balance. */
function pathMinimumsSorted(openingBalanceCents: number, postOpeningMin: Float64Array): Float64Array {
  const minimums = sortedCopy(postOpeningMin);

  for (let path = 0; path < minimums.length; path += 1) {
    if (minimums[path] > openingBalanceCents) minimums[path] = openingBalanceCents;
  }

  return minimums;
}

function forecastBands(
  input: SimulationInput,
  { schedule, percentiles }: PathSet,
  cumulative?: Float64Array,
): ForecastBand[] {
  const bands: ForecastBand[] = [];

  for (let day = 0; day < schedule.dayCount; day += 1) {
    const shift = cumulative ? cumulative[day] : 0;

    bands.push({
      date: addDays(input.referenceDate, day),
      dayIndex: day,
      p10Cents: percentiles.p10[day] + shift,
      p50Cents: percentiles.p50[day] + shift,
      p90Cents: percentiles.p90[day] + shift,
      scheduledIncomeCents: schedule.incomeCents[day],
      scheduledBillsCents: schedule.billsCents[day],
      expectedSpendingCents: schedule.expectedSpendingCents[day],
      scenarioCents: cumulative ? cumulative[day] - (day > 0 ? cumulative[day - 1] : 0) : 0,
    });
  }

  return bands;
}

function tightestDay(bands: ForecastBand[]): ForecastBand {
  return bands.reduce((lowest, band) => (band.p10Cents < lowest.p10Cents ? band : lowest));
}

function timelineTotals(input: SimulationInput): TimelineTotals {
  const sum = (amounts: number[]) => amounts.reduce((total, amount) => total + amount, 0);
  const next = input.scheduledIncome[0];

  return {
    scheduledIncomeCents: sum(input.scheduledIncome.map((event) => event.amountCents)),
    scheduledIncomeCount: input.scheduledIncome.length,
    scheduledBillsCents: sum(input.scheduledBills.map((event) => event.amountCents)),
    scheduledBillsCount: input.scheduledBills.length,
    expectedEssentialCents: sum(
      input.variableSpending
        .filter((occurrence) => occurrence.kind === "essential")
        .map((occurrence) => occurrence.expectedCents),
    ),
    expectedDiscretionaryCents: sum(
      input.variableSpending
        .filter((occurrence) => occurrence.kind === "discretionary")
        .map((occurrence) => occurrence.expectedCents),
    ),
    nextIncome: next ? { date: next.date, amountCents: next.amountCents } : null,
  };
}

function riskMetrics(input: SimulationInput, set: PathSet, safety: SafetyMetrics, bands: ForecastBand[]): RiskMetrics {
  const { paths, postOpeningMinimum: postMin } = set;
  const { pathCount, dayCount, closing, openingBalanceCents } = paths;
  const minimumCents = input.protectedMinimumCents;
  const minimums = pathMinimumsSorted(openingBalanceCents, postMin);
  const tightest = tightestDay(bands);

  // First day each path falls below the minimum; -1 when it never does.
  const firstBreach = new Int32Array(pathCount).fill(-1);
  const shortfalls: number[] = [];

  for (let day = 0; day < dayCount; day += 1) {
    const offset = day * pathCount;

    for (let path = 0; path < pathCount; path += 1) {
      if (firstBreach[path] < 0 && closing[offset + path] < minimumCents) firstBreach[path] = day;
    }
  }

  const breachDays: number[] = [];

  for (let path = 0; path < pathCount; path += 1) {
    if (firstBreach[path] >= 0) {
      breachDays.push(firstBreach[path]);
      shortfalls.push(minimumCents - Math.min(openingBalanceCents, postMin[path]));
    }
  }

  const medianFirstBreachDay =
    breachDays.length > 0 ? Math.round(quantileSorted(sortedCopy(breachDays), 0.5)) : null;
  const variableSorted = sortedCopy(paths.variableSpendingTotal);
  const expectedVariable = set.schedule.expectedSpendingCents.reduce((total, value) => total + value, 0);

  let emergencies: RiskMetrics["emergencies"] = null;

  if (input.emergencies) {
    let withAny = 0;
    let breachWithAny = 0;
    let breachWithNone = 0;

    for (let path = 0; path < pathCount; path += 1) {
      const breached = firstBreach[path] >= 0;

      if (paths.emergencyCount[path] > 0) {
        withAny += 1;
        if (breached) breachWithAny += 1;
      } else if (breached) {
        breachWithNone += 1;
      }
    }

    emergencies = {
      probabilityOfAny: withAny / pathCount,
      breachWithAny: withAny > 0 ? breachWithAny / withAny : null,
      breachWithNone: withAny < pathCount ? breachWithNone / (pathCount - withAny) : null,
    };
  }

  const metrics: Omit<RiskMetrics, "drivers"> = {
    medianEndingBalanceCents: bands[bands.length - 1].p50Cents,
    minimumBalanceP5Cents: Math.round(quantileSorted(minimums, 0.05)),
    medianMinimumBalanceCents: Math.round(quantileSorted(minimums, 0.5)),
    tightestDay: { date: tightest.date, p10Cents: tightest.p10Cents, p50Cents: tightest.p50Cents },
    medianFirstBreach:
      medianFirstBreachDay === null
        ? null
        : { dayIndex: medianFirstBreachDay, date: addDays(input.referenceDate, medianFirstBreachDay) },
    medianShortfallCents:
      shortfalls.length > 0 ? Math.round(quantileSorted(sortedCopy(shortfalls), 0.5)) : null,
    variableSpending: {
      expectedCents: expectedVariable,
      p10Cents: Math.round(quantileSorted(variableSorted, 0.1)),
      p90Cents: Math.round(quantileSorted(variableSorted, 0.9)),
    },
    emergencies,
  };

  return { ...metrics, drivers: riskDrivers(input, safety, metrics) };
}

function riskDrivers(
  input: SimulationInput,
  safety: SafetyMetrics,
  metrics: Omit<RiskMetrics, "drivers">,
): RiskDriver[] {
  const drivers: RiskDriver[] = [];
  const minimum = input.protectedMinimumCents;
  const { tightestDay: tightest } = metrics;

  drivers.push({
    id: "tightest_day",
    title: `Tightest point around ${formatMediumDate(tightest.date)}`,
    detail: `In the lowest 10% of simulated paths, your balance is ${formatCents(
      tightest.p10Cents,
    )} or less that day; the median path has ${formatCents(tightest.p50Cents)}. Your protected minimum is ${formatCents(minimum)}.`,
    source: "simulated",
    tone: tightest.p10Cents < minimum ? "risk" : tightest.p10Cents < minimum * 1.5 ? "caution" : "neutral",
  });

  if (metrics.medianFirstBreach && metrics.medianShortfallCents !== null) {
    drivers.push({
      id: "breach_timing",
      title: `${percent(safety.breachProbability)} of paths dip below your minimum`,
      detail: `When they do, it typically first happens around ${formatMediumDate(
        metrics.medianFirstBreach.date,
      )}, falling a median of ${formatCents(metrics.medianShortfallCents)} below it.`,
      source: "simulated",
      tone: safety.breachProbability > 1 - input.targetConfidence ? "risk" : "caution",
    });
  }

  const largestBill = input.scheduledBills.reduce<SimulationInput["scheduledBills"][number] | null>(
    (largest, bill) => (!largest || bill.amountCents > largest.amountCents ? bill : largest),
    null,
  );

  if (largestBill) {
    drivers.push({
      id: "largest_bill",
      title: `Largest bill: ${largestBill.name}`,
      detail: `${formatCents(largestBill.amountCents)} due ${formatMediumDate(largestBill.date)}. Scheduled bills total ${formatCents(
        input.scheduledBills.reduce((total, bill) => total + bill.amountCents, 0),
      )} over the next ${input.horizonDays} days and are the same on every path.`,
      source: "scheduled",
      tone: largestBill.date <= tightest.date ? "caution" : "neutral",
    });
  }

  const nextIncome = input.scheduledIncome[0];

  drivers.push(
    nextIncome
      ? {
          id: "income_timing",
          title: `Next income ${formatMediumDate(nextIncome.date)}`,
          detail: `${nextIncome.name}, ${formatCents(nextIncome.amountCents)}${
            nextIncome.confidence === "estimated" ? " — expected, not scheduled; assumed to arrive on time" : ""
          }. Money that leaves before it arrives is what sets your tightest days.`,
          source: nextIncome.confidence === "estimated" ? "estimated" : "scheduled",
          tone: nextIncome.date > tightest.date ? "caution" : "neutral",
        }
      : {
          id: "income_timing",
          title: "No income in this forecast",
          detail: `No income is scheduled in the next ${input.horizonDays} days, so the balance only goes down.`,
          source: "scheduled",
          tone: "risk",
        },
  );

  const { expectedCents, p10Cents, p90Cents } = metrics.variableSpending;
  const fromHistory = (["essential", "discretionary"] as const).filter(
    (kind) => input.spendingModel[kind].basis === "transaction_history",
  );

  if (expectedCents > 0) {
    drivers.push({
      id: "variable_spending",
      title: `Everyday spending: about ${formatCents(expectedCents)}`,
      detail: `The middle 80% of simulated paths spend between ${formatCents(p10Cents)} and ${formatCents(
        p90Cents,
      )} on everyday spending over ${input.horizonDays} days. ${
        fromHistory.length > 0
          ? `How much it varies is measured from your ${fromHistory.join(" and ")} transaction history.`
          : "How much it varies uses default assumptions, not your history."
      }`,
      source: "simulated",
      tone: "neutral",
    });
  }

  if (input.emergencies && metrics.emergencies) {
    const { probabilityOfAny, breachWithAny, breachWithNone } = metrics.emergencies;
    const comparison =
      breachWithAny !== null && breachWithNone !== null
        ? ` Paths with one fall below your minimum ${percent(breachWithAny)} of the time, against ${percent(breachWithNone)} without.`
        : "";

    drivers.push({
      id: "emergencies",
      title: "Unexpected expenses (an assumption)",
      detail: `The simulation assumes about ${input.emergencies.eventsPerYear} unexpected expenses a year averaging ${formatCents(
        input.emergencies.meanCostCents,
      )} — a modelling assumption, not something known about you. ${percent(
        probabilityOfAny,
      )} of paths include at least one in this forecast.${comparison}`,
      source: "assumption",
      tone: "neutral",
    });
  } else {
    drivers.push({
      id: "emergencies",
      title: "Unexpected expenses are off",
      detail: "You've chosen to leave out unexpected expenses, so this forecast may be optimistic. You can turn them on in Settings.",
      source: "assumption",
      tone: "caution",
    });
  }

  return drivers;
}

function summarize(input: SimulationInput, set: PathSet): SimulationResult {
  const safety = safetyMetrics(set.paths, set.postOpeningMinimum, input.protectedMinimumCents);
  const forecast = forecastBands(input, set);

  return {
    inputFingerprint: input.fingerprint,
    pathsKey: input.pathsKey,
    pathCount: input.pathCount,
    seed: input.seed,
    referenceDate: input.referenceDate,
    horizonDays: input.horizonDays,
    openingBalanceCents: input.openingBalanceCents,
    protectedMinimumCents: input.protectedMinimumCents,
    targetConfidence: input.targetConfidence,
    safety,
    safeToSpend: optimizeSafeToSpend({
      openingBalanceCents: input.openingBalanceCents,
      postOpeningMinimum: set.postOpeningMinimum,
      protectedMinimumCents: input.protectedMinimumCents,
      targetConfidence: input.targetConfidence,
    }),
    forecast,
    risk: riskMetrics(input, set, safety, forecast),
    totals: timelineTotals(input),
    spendingModel: input.spendingModel,
    emergencies: input.emergencies,
    warnings: input.warnings,
  };
}

function evaluateScenario(
  input: SimulationInput,
  set: PathSet,
  baseline: SimulationResult,
  scenario: FinancialScenario,
): ScenarioResult {
  const issues = scenarioIssues(scenario, input);

  if (issues.length > 0) {
    throw new Error(`${scenario.description || "Scenario"}: ${issues.join(" ")}`);
  }

  const { paths } = set;
  const { cashFlows, warnings } = scenarioCashFlows(scenario, input);
  const cumulative = cumulativeChange(cashFlows, paths.dayCount);
  const postMin = postOpeningMinimum(paths, cumulative);
  const netChangeCents = cumulative[paths.dayCount - 1];
  const safety = safetyMetrics(paths, postMin, input.protectedMinimumCents, netChangeCents);
  const forecast = forecastBands(input, set, cumulative);
  const tightest = tightestDay(forecast);
  const minimums = pathMinimumsSorted(paths.openingBalanceCents, postMin);

  return {
    scenario,
    cashFlows,
    netChangeCents,
    safety,
    safetyChangePoints: (safety.safetyProbability - baseline.safety.safetyProbability) * 100,
    meetsTarget: safety.safePaths >= baseline.safeToSpend.requiredSafePaths,
    safeToSpendAfter: optimizeSafeToSpend({
      openingBalanceCents: paths.openingBalanceCents,
      postOpeningMinimum: postMin,
      protectedMinimumCents: input.protectedMinimumCents,
      targetConfidence: input.targetConfidence,
    }),
    medianEndingBalanceCents: forecast[forecast.length - 1].p50Cents,
    minimumBalanceP5Cents: Math.round(quantileSorted(minimums, 0.05)),
    tightestDay: { date: tightest.date, p10Cents: tightest.p10Cents },
    forecast,
    warnings,
  };
}

export interface SimulationRuntime {
  run(input: SimulationInput): SimulationResult;
  compare(input: SimulationInput, scenarios: FinancialScenario[]): ScenarioComparison;
  /** How many times paths were actually simulated; cache hits don't count. */
  readonly simulations: number;
}

export function createSimulationRuntime({ maxCachedPathSets = 3 } = {}): SimulationRuntime {
  const cache = new Map<string, PathSet>();
  let simulations = 0;

  function pathSet(input: SimulationInput): PathSet {
    const cached = cache.get(input.pathsKey);

    if (cached) {
      // Re-insert to mark as most recently used.
      cache.delete(input.pathsKey);
      cache.set(input.pathsKey, cached);
      return cached;
    }

    const set = buildPathSet(input);
    simulations += 1;
    cache.set(input.pathsKey, set);

    while (cache.size > maxCachedPathSets) {
      cache.delete(cache.keys().next().value as string);
    }

    return set;
  }

  return {
    run(input) {
      return summarize(input, pathSet(input));
    },
    compare(input, scenarios) {
      const set = pathSet(input);
      const baseline = summarize(input, set);

      return {
        inputFingerprint: input.fingerprint,
        pathsKey: input.pathsKey,
        baseline,
        scenarios: scenarios.map((scenario) => evaluateScenario(input, set, baseline, scenario)),
      };
    },
    get simulations() {
      return simulations;
    },
  };
}

/** One-off run without a cache. */
export function runSimulation(input: SimulationInput): SimulationResult {
  return createSimulationRuntime().run(input);
}
