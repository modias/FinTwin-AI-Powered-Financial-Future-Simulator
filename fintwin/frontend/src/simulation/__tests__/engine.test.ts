/**
 * The Monte Carlo engine's required behaviour. Each `describe` block is one
 * requirement; the numbered titles match the engine specification.
 */

import { describe, expect, it } from "vitest";

import { demoDataset } from "@/data/demo-profile";
import { PRIMARY_ACCOUNT_ID } from "@/data/mock-accounts";
import { datasetForProfile } from "@/lib/profile/dataset";
import { makeProfile } from "@/lib/profile/__tests__/fixtures";
import {
  EMERGENCY_ALLOWANCE_BILL_ID,
} from "@/lib/profile/timeline";
import {
  FALLBACK_SPENDING_VARIATION,
} from "@/simulation/assumptions";
import { postOpeningMinimum, simulatePaths } from "@/simulation/cashflow";
import { sampleAmountCents } from "@/simulation/distributions";
import { createSimulationRuntime, runSimulation } from "@/simulation/engine";
import {
  BASELINE_BELOW_TARGET_WARNING,
  optimizeSafeToSpend,
  requiredSafePaths,
} from "@/simulation/optimizer";
import { dailyPercentiles, quantileSorted } from "@/simulation/percentiles";
import { createRandom } from "@/simulation/random";
import type { FinancialScenario } from "@/simulation/types";
import {
  REFERENCE_DATE,
  bill,
  makeDataset,
  makeInput,
  paycheck,
  purchase,
} from "@/simulation/__tests__/helpers";

const groceries = bill("groceries", 150, "2026-10-16", "weekly", {
  category: "Food",
  confidence: "estimated",
  spendingKind: "essential",
});
const dining = bill("dining", 80, "2026-10-17", "weekly", {
  category: "Food",
  confidence: "estimated",
  spendingKind: "discretionary",
});

/** A typical month: paid biweekly, rent on the 1st, weekly everyday spending. */
const typicalDataset = makeDataset({
  balance: 1_800,
  income: [paycheck("pay", 1_500, "2026-10-16")],
  bills: [
    bill("rent", 1_300, "2026-10-01", "monthly", { category: "Housing" }),
    bill("phone", 45, "2026-10-20"),
    groceries,
    dining,
  ],
});

const demoInput = (options: Parameters<typeof makeInput>[1] = {}) =>
  makeInput(demoDataset, { horizonDays: 90, emergenciesEnabled: true, ...options });

describe("1. reproducibility", () => {
  it("gives identical results for the same inputs and seed", () => {
    const first = runSimulation(demoInput());
    const second = runSimulation(demoInput());

    expect(second).toEqual(first);
  });

  it("gives different paths for a different seed", () => {
    const first = runSimulation(demoInput());
    const other = runSimulation(demoInput({ seed: 7 }));

    expect(other.forecast.map((band) => band.p10Cents)).not.toEqual(
      first.forecast.map((band) => band.p10Cents),
    );
  });

  it("produces a stable random stream from a seed", () => {
    const a = createRandom(42);
    const b = createRandom(42);
    const drawsA = Array.from({ length: 5 }, () => a.next());

    expect(Array.from({ length: 5 }, () => b.next())).toEqual(drawsA);
    expect(drawsA.every((value) => value >= 0 && value < 1)).toBe(true);
  });
});

describe("2. income dates", () => {
  it("places biweekly paychecks on their exact dates and days", () => {
    const input = makeInput(
      makeDataset({ income: [paycheck("pay", 1_500, "2026-10-16")] }),
      { horizonDays: 60 },
    );

    expect(input.scheduledIncome.map((event) => [event.date, event.dayIndex])).toEqual([
      ["2026-10-16", 4],
      ["2026-10-30", 18],
      ["2026-11-13", 32],
      ["2026-11-27", 46],
      ["2026-12-11", 60],
    ]);
    expect(input.scheduledIncome.every((event) => event.amountCents === 150_000)).toBe(true);
  });

  it("does not include a paycheck on the reference date, which the balance already reflects", () => {
    const input = makeInput(makeDataset({ income: [paycheck("pay", 1_500, REFERENCE_DATE)] }));

    expect(input.scheduledIncome[0].date).toBe("2026-10-26");
  });
});

describe("3. rent and bill dates", () => {
  it("places monthly rent and other bills on their due dates", () => {
    const input = makeInput(
      makeDataset({
        bills: [
          bill("rent", 1_300, "2026-09-01", "monthly", { category: "Housing" }),
          bill("gym", 30, "2026-10-14", "weekly"),
        ],
      }),
      { horizonDays: 60 },
    );
    const datesOf = (id: string) =>
      input.scheduledBills.filter((event) => event.sourceId === id).map((event) => event.date);

    expect(datesOf("rent")).toEqual(["2026-11-01", "2026-12-01"]);
    expect(datesOf("gym")).toEqual([
      "2026-10-14",
      "2026-10-21",
      "2026-10-28",
      "2026-11-04",
      "2026-11-11",
      "2026-11-18",
      "2026-11-25",
      "2026-12-02",
      "2026-12-09",
    ]);
  });
});

describe("4. no double counting", () => {
  it("applies each scheduled event exactly once", () => {
    const dataset = makeDataset({
      balance: 1_000,
      income: [paycheck("pay", 1_000, "2026-10-16")],
      bills: [bill("rent", 900, "2026-11-01", "monthly", { category: "Housing" })],
    });
    const result = runSimulation(makeInput(dataset, { horizonDays: 30 }));
    const end = result.forecast[result.forecast.length - 1];

    // Paid on Oct 16 and Oct 30, rent on Nov 1: 1,000 + 2,000 − 900.
    expect(end.p50Cents).toBe(210_000);
    expect(result.forecast.reduce((total, band) => total + band.scheduledIncomeCents, 0)).toBe(
      200_000,
    );
  });

  it("replaces the profile's unexpected-expense allowance with simulated emergencies", () => {
    const profile = makeProfile({ emergencies: { enabled: true } });
    const dataset = datasetForProfile(profile);
    const input = makeInput(dataset, { emergenciesEnabled: true, horizonDays: 90 });

    expect(dataset.bills.some((entry) => entry.id === EMERGENCY_ALLOWANCE_BILL_ID)).toBe(true);
    expect(
      [...input.scheduledBills, ...input.variableSpending].some(
        (event) => event.sourceId === EMERGENCY_ALLOWANCE_BILL_ID,
      ),
    ).toBe(false);
    expect(input.emergencies).not.toBeNull();
  });

  it("does not add history-based spending for a kind that already has an estimate", () => {
    const input = demoInput();
    const sources = new Set(input.variableSpending.map((occurrence) => occurrence.sourceId));

    // The demo estimates groceries and fuel, so essential history is only used for variation.
    expect(sources.has("history_essential_spending")).toBe(false);
    expect(sources.has("history_discretionary_spending")).toBe(true);
  });
});

describe("5. short months", () => {
  it("clamps a bill due on the 31st to the end of shorter months", () => {
    const input = makeInput(
      makeDataset({ bills: [bill("loan", 250, "2026-08-31", "monthly", { category: "Debt" })] }),
      { horizonDays: 90 },
    );

    expect(input.scheduledBills.map((event) => event.date)).toEqual([
      "2026-10-31",
      "2026-11-30",
      "2026-12-31",
    ]);
  });

  it("handles February", () => {
    const input = makeInput(
      makeDataset({
        referenceDate: "2027-01-15",
        bills: [bill("loan", 250, "2027-01-31", "monthly", { category: "Debt" })],
      }),
      { horizonDays: 60 },
    );

    expect(input.scheduledBills.map((event) => event.date)).toEqual(["2027-01-31", "2027-02-28"]);
  });
});

describe("6. no negative spending", () => {
  it("clamps sampled amounts at zero", () => {
    expect(sampleAmountCents(10_000, -3)).toBe(0);
    expect(sampleAmountCents(10_000, 0.5)).toBe(5_000);
  });

  it("never draws negative spending, even with extreme variation", () => {
    const input = makeInput(makeDataset({ balance: 5_000, bills: [groceries, dining] }));

    input.variableSpending.forEach((occurrence) => {
      occurrence.variation = 1.5;
    });

    const paths = simulatePaths(input);

    // With no income, no day can raise the balance.
    for (let day = 1; day < paths.dayCount; day += 1) {
      for (let path = 0; path < paths.pathCount; path += 1) {
        expect(paths.closing[day * paths.pathCount + path]).toBeLessThanOrEqual(
          paths.closing[(day - 1) * paths.pathCount + path],
        );
      }
    }
    expect(Math.min(...paths.variableSpendingTotal)).toBeGreaterThanOrEqual(0);
  });
});

describe("7. purchases today", () => {
  const dataset = makeDataset({ balance: 1_000, income: [paycheck("pay", 2_000, "2026-10-16")] });

  it("fails every path when a purchase today breaches the minimum, even though income follows", () => {
    const comparison = createSimulationRuntime().compare(makeInput(dataset), [
      purchase(70_001, REFERENCE_DATE),
      purchase(70_000, REFERENCE_DATE),
    ]);

    expect(comparison.baseline.safety.safetyProbability).toBe(1);
    expect(comparison.scenarios[0].safety.safetyProbability).toBe(0);
    expect(comparison.scenarios[1].safety.safetyProbability).toBe(1);
  });

  it("fails every path when the opening balance is already below the minimum", () => {
    const result = runSimulation(makeInput(dataset, { protectedMinimumCents: 100_001 }));

    expect(result.safety.safetyProbability).toBe(0);
    expect(result.safeToSpend.status).toBe("below_minimum_today");
    expect(result.safeToSpend.amountCents).toBe(0);
  });
});

describe("8. temporary breaches", () => {
  it("fails a path that dips below the minimum and recovers", () => {
    const dataset = makeDataset({
      balance: 1_000,
      bills: [bill("car", 900, "2026-10-14", "monthly", { category: "Transportation" })],
      income: [paycheck("pay", 2_000, "2026-10-16")],
    });
    const result = runSimulation(makeInput(dataset));

    expect(result.safety.endingAboveMinimumProbability).toBe(1);
    expect(result.safety.safetyProbability).toBe(0);
    expect(result.safety.breachProbability).toBe(1);
  });

  it("fails a path when a purchase breaches the minimum the day before payday", () => {
    const dataset = makeDataset({ balance: 400, income: [paycheck("pay", 2_000, "2026-10-16")] });
    const comparison = createSimulationRuntime().compare(makeInput(dataset), [
      purchase(20_000, "2026-10-15"),
    ]);

    expect(comparison.scenarios[0].safety.safetyProbability).toBe(0);
  });
});

describe("9. safety probability", () => {
  it("counts paths that never breach, matching a brute-force recount", () => {
    const input = makeInput(typicalDataset, { emergenciesEnabled: true, horizonDays: 60 });
    const result = runSimulation(input);
    const paths = simulatePaths(input);
    let safe = 0;

    for (let path = 0; path < paths.pathCount; path += 1) {
      let breached = false;

      for (let day = 0; day < paths.dayCount; day += 1) {
        if (paths.closing[day * paths.pathCount + path] < input.protectedMinimumCents) {
          breached = true;
        }
      }

      if (!breached) safe += 1;
    }

    expect(result.safety.safePaths).toBe(safe);
    expect(result.safety.safetyProbability).toBe(safe / input.pathCount);
    expect(result.safety.breachProbability).toBeCloseTo(1 - safe / input.pathCount, 12);
    expect(result.safety.safetyProbability).toBeGreaterThan(0);
    expect(result.safety.safetyProbability).toBeLessThan(1);
    expect(result.safety.endingAboveMinimumProbability).toBeGreaterThanOrEqual(
      result.safety.safetyProbability,
    );
  });
});

describe("10. bigger purchases", () => {
  it("never improve safety", () => {
    const amounts = [5_000, 20_000, 40_000, 60_000, 90_000, 150_000];
    const comparison = createSimulationRuntime().compare(
      demoInput(),
      // Three at a time is the app's limit, but the engine itself has none.
      amounts.map((amount) => purchase(amount, REFERENCE_DATE)),
    );
    const safety = comparison.scenarios.map((scenario) => scenario.safety.safetyProbability);

    expect(safety[0]).toBeLessThanOrEqual(comparison.baseline.safety.safetyProbability);
    safety.slice(1).forEach((value, index) => expect(value).toBeLessThanOrEqual(safety[index]));
    expect(safety[safety.length - 1]).toBeLessThan(safety[0]);
  });
});

describe("11. protected minimum", () => {
  it("never increases safe-to-spend when raised", () => {
    const runtime = createSimulationRuntime();
    const amounts = [0, 30_000, 60_000, 100_000, 150_000].map(
      (minimum) => runtime.run(demoInput({ protectedMinimumCents: minimum })).safeToSpend.amountCents,
    );

    amounts.slice(1).forEach((amount, index) => expect(amount).toBeLessThanOrEqual(amounts[index]));
    expect(amounts[0]).toBeGreaterThan(amounts[amounts.length - 1]);
  });
});

describe("12. safety target", () => {
  it("never increases safe-to-spend when raised", () => {
    const runtime = createSimulationRuntime();
    const amounts = [0.9, 0.95, 0.99].map(
      (target) => runtime.run(demoInput({ targetConfidence: target })).safeToSpend.amountCents,
    );

    expect(amounts[1]).toBeLessThanOrEqual(amounts[0]);
    expect(amounts[2]).toBeLessThanOrEqual(amounts[1]);
  });
});

describe("13. baseline below target", () => {
  it("returns $0 with the exact warning", () => {
    const dataset = makeDataset({
      balance: 800,
      bills: [bill("rent", 1_000, "2026-10-20", "monthly", { category: "Housing" })],
      // Monthly, so the only paycheck arrives after rent.
      income: [paycheck("pay", 2_000, "2026-10-30", "monthly")],
    });
    const result = runSimulation(makeInput(dataset));

    expect(result.safeToSpend).toMatchObject({
      amountCents: 0,
      status: "baseline_below_target",
      warning:
        "Your current financial forecast does not meet your selected safety target, even without an additional purchase.",
    });
    expect(BASELINE_BELOW_TARGET_WARNING).toBe(result.safeToSpend.warning);
  });
});

describe("14. safe-to-spend meets the target", () => {
  it("is the largest whole-cent purchase today that keeps the target, on the same paths", () => {
    const runtime = createSimulationRuntime();
    const input = demoInput();
    const { safeToSpend, safety } = runtime.run(input);

    expect(safeToSpend.status).toBe("meets_target");
    expect(Number.isInteger(safeToSpend.amountCents)).toBe(true);
    expect(safeToSpend.amountCents).toBeGreaterThan(0);
    expect(safeToSpend.amountCents).toBeLessThanOrEqual(input.openingBalanceCents);
    expect(safety.safetyProbability).toBeGreaterThanOrEqual(0.95);

    const [atAmount, oneCentMore] = runtime.compare(input, [
      purchase(safeToSpend.amountCents, REFERENCE_DATE),
      purchase(safeToSpend.amountCents + 1, REFERENCE_DATE),
    ]).scenarios;

    expect(atAmount.safety.safetyProbability).toBeGreaterThanOrEqual(0.95);
    expect(atAmount.safety.safetyProbability).toBe(safeToSpend.safetyAtAmount);
    expect(oneCentMore.safety.safetyProbability).toBeLessThan(0.95);
  });

  it("uses ceil(target × paths) as the required number of safe paths", () => {
    expect(requiredSafePaths(0.95, 10_000)).toBe(9_500);
    expect(requiredSafePaths(0.99, 10_000)).toBe(9_900);
    expect(requiredSafePaths(0.9, 7)).toBe(7);
    expect(requiredSafePaths(0.95, 21)).toBe(20);
  });

  it("is the order statistic of the path minima, floored to a cent and capped by the balance", () => {
    const minima = Float64Array.from([50_000, 40_000.6, 90_000, 70_000, 60_000]);

    expect(
      optimizeSafeToSpend({
        openingBalanceCents: 100_000,
        postOpeningMinimum: minima,
        protectedMinimumCents: 30_000,
        targetConfidence: 0.8,
      }),
    ).toMatchObject({ amountCents: 20_000, status: "meets_target", safetyAtAmount: 0.8 });

    expect(
      optimizeSafeToSpend({
        openingBalanceCents: 100_000,
        postOpeningMinimum: minima,
        protectedMinimumCents: 30_000,
        targetConfidence: 0.99,
      }),
    ).toMatchObject({ amountCents: 10_000, safetyAtAmount: 1 });
  });
});

describe("15. common random numbers", () => {
  const laptopToday = purchase(120_000, REFERENCE_DATE, { id: "today", description: "Laptop today" });
  const laptopAfterPayday = purchase(120_000, "2026-10-17", {
    id: "after_payday",
    type: "delayed_purchase",
    description: "Laptop after payday",
  });
  const cheaperLaptop = purchase(70_000, REFERENCE_DATE, { id: "cheaper", description: "$700 laptop" });

  it("evaluates every scenario on the baseline's paths without simulating again", () => {
    const runtime = createSimulationRuntime();
    const input = demoInput();
    const baseline = runtime.run(input);
    const comparison = runtime.compare(input, [laptopToday, laptopAfterPayday, cheaperLaptop]);

    expect(runtime.simulations).toBe(1);
    expect(comparison.baseline).toEqual(baseline);

    // Changing the minimum or target re-summarises the same paths.
    runtime.run({ ...input, protectedMinimumCents: 50_000, fingerprint: "other" });
    expect(runtime.simulations).toBe(1);
  });

  it("gives exactly the baseline result for a change with no effect", () => {
    const comparison = createSimulationRuntime().compare(makeInput(typicalDataset), [
      {
        id: "no_rent_change",
        type: "rent_decrease",
        amountCents: 10_000,
        // No rent falls after the 1st of next month within 30 days.
        effectiveDate: "2026-11-02",
        frequency: null,
        description: "Rent decrease",
      },
    ]);
    const [scenario] = comparison.scenarios;

    expect(scenario.cashFlows).toEqual([]);
    expect(scenario.warnings).toHaveLength(1);
    expect(scenario.safety).toEqual(comparison.baseline.safety);
    expect(scenario.safetyChangePoints).toBe(0);
  });

  it("ranks the options consistently: cheaper today beats the same laptop today", () => {
    const [today, afterPayday, cheaper] = createSimulationRuntime().compare(demoInput(), [
      laptopToday,
      laptopAfterPayday,
      cheaperLaptop,
    ]).scenarios;

    expect(cheaper.safety.safetyProbability).toBeGreaterThanOrEqual(today.safety.safetyProbability);
    expect(afterPayday.safety.safetyProbability).toBeGreaterThanOrEqual(
      today.safety.safetyProbability,
    );
  });
});

describe("16. delayed purchases", () => {
  it("affect the balance only from their effective date", () => {
    const delayed: FinancialScenario = {
      id: "delayed",
      type: "delayed_purchase",
      amountCents: 60_000,
      effectiveDate: "2026-10-20",
      frequency: null,
      description: "PlayStation after payday",
    };
    const comparison = createSimulationRuntime().compare(makeInput(typicalDataset), [delayed]);
    const baselineBands = comparison.baseline.forecast;
    const [scenario] = comparison.scenarios;

    expect(scenario.cashFlows).toEqual([{ date: "2026-10-20", dayIndex: 8, amountCents: -60_000 }]);
    scenario.forecast.forEach((band, day) => {
      const shift = band.date < "2026-10-20" ? 0 : -60_000;

      expect(band.p50Cents).toBe(baselineBands[day].p50Cents + shift);
      expect(band.p10Cents).toBe(baselineBands[day].p10Cents + shift);
    });
  });

  it("rejects a delayed purchase dated today or outside the horizon", () => {
    const runtime = createSimulationRuntime();
    const input = makeInput(typicalDataset);

    expect(() =>
      runtime.compare(input, [purchase(1_000, REFERENCE_DATE, { type: "delayed_purchase" })]),
    ).toThrow(/after today/);
    expect(() => runtime.compare(input, [purchase(1_000, "2027-01-01")])).toThrow(/within the 30-day/);
  });
});

describe("17. percentiles", () => {
  it("interpolates linearly between order statistics", () => {
    const sorted = [1, 2, 3, 4, 5];

    expect(quantileSorted(sorted, 0)).toBe(1);
    expect(quantileSorted(sorted, 0.5)).toBe(3);
    expect(quantileSorted(sorted, 0.1)).toBeCloseTo(1.4, 12);
    expect(quantileSorted(sorted, 0.9)).toBeCloseTo(4.6, 12);
    expect(quantileSorted(sorted, 1)).toBe(5);
    expect(quantileSorted([7], 0.9)).toBe(7);
  });

  it("computes each day's band across paths", () => {
    // Two days, five paths; day 1 is unsorted on purpose.
    const percentiles = dailyPercentiles({
      pathCount: 5,
      dayCount: 2,
      openingBalanceCents: 100,
      closing: Float64Array.from([100, 100, 100, 100, 100, 50, 10, 40, 30, 20]),
      variableSpendingTotal: new Float64Array(5),
      emergencyTotal: new Float64Array(5),
      emergencyCount: new Uint16Array(5),
    });

    expect(Array.from(percentiles.p50)).toEqual([100, 30]);
    expect(Array.from(percentiles.p10)).toEqual([100, 14]);
    expect(Array.from(percentiles.p90)).toEqual([100, 46]);
  });

  it("keeps the 10th, 50th and 90th percentiles ordered on every day", () => {
    const result = runSimulation(demoInput());

    result.forecast.forEach((band) => {
      expect(band.p10Cents).toBeLessThanOrEqual(band.p50Cents);
      expect(band.p50Cents).toBeLessThanOrEqual(band.p90Cents);
    });
  });
});

describe("18. fallback assumptions", () => {
  it("uses documented defaults without history", () => {
    const input = makeInput(datasetForProfile(makeProfile()));

    expect(input.spendingModel.essential).toMatchObject({
      basis: "fallback",
      ...FALLBACK_SPENDING_VARIATION.essential,
      history: null,
    });
    expect(input.spendingModel.discretionary).toMatchObject({
      basis: "fallback",
      ...FALLBACK_SPENDING_VARIATION.discretionary,
    });
    expect(input.warnings.some((warning) => warning.code === "limited_history")).toBe(false);
  });

  it("measures variation from history when there is enough", () => {
    const input = demoInput();

    expect(input.accountId).toBe(PRIMARY_ACCOUNT_ID);
    expect(input.spendingModel.essential.basis).toBe("transaction_history");
    expect(input.spendingModel.essential.history?.weeks).toBeGreaterThanOrEqual(4);
    expect(input.warnings.some((warning) => warning.message.includes("limited information"))).toBe(
      false,
    );
  });
});

describe("19. invalidation", () => {
  const base = () => makeInput(datasetForProfile(makeProfile()));

  it("changes the simulated paths when any onboarding answer changes", () => {
    const changedPay = makeInput(
      datasetForProfile(
        makeProfile({
          income: { frequency: "biweekly", paycheckAmountCents: 160_000, nextPayday: "2026-10-16" },
        }),
      ),
    );
    const changedEmergencies = makeInput(
      datasetForProfile(makeProfile({ emergencies: { enabled: true } })),
      { emergenciesEnabled: true },
    );

    expect(changedPay.pathsKey).not.toBe(base().pathsKey);
    expect(changedPay.fingerprint).not.toBe(base().fingerprint);
    expect(changedEmergencies.pathsKey).not.toBe(base().pathsKey);
  });

  it("changes the result, but reuses the paths, when the minimum or target changes", () => {
    const minimum = makeInput(datasetForProfile(makeProfile()), { protectedMinimumCents: 50_000 });
    const target = makeInput(datasetForProfile(makeProfile()), { targetConfidence: 0.99 });
    const horizon = makeInput(datasetForProfile(makeProfile()), { horizonDays: 60 });

    expect(minimum.fingerprint).not.toBe(base().fingerprint);
    expect(minimum.pathsKey).toBe(base().pathsKey);
    expect(target.fingerprint).not.toBe(base().fingerprint);
    expect(target.pathsKey).toBe(base().pathsKey);
    expect(horizon.pathsKey).not.toBe(base().pathsKey);
  });

  it("labels each result with the input it came from", () => {
    const input = base();

    expect(runSimulation(input).inputFingerprint).toBe(input.fingerprint);
  });
});

describe("20. a deterministic example", () => {
  it("matches a hand-computed balance to the cent", () => {
    const dataset = makeDataset({
      balance: 2_000,
      income: [paycheck("pay", 1_500, "2026-10-16")],
      bills: [
        bill("rent", 1_200, "2026-11-01", "monthly", { category: "Housing" }),
        bill("phone", 45.5, "2026-10-20"),
      ],
    });
    const result = runSimulation(makeInput(dataset, { pathCount: 50 }));
    const byDate = new Map(result.forecast.map((band) => [band.date, band]));

    // 2,000 → +1,500 (Oct 16) → −45.50 (Oct 20) → +1,500 (Oct 30) → −1,200 (Nov 1)
    expect(byDate.get("2026-10-16")?.p50Cents).toBe(350_000);
    expect(byDate.get("2026-10-20")?.p50Cents).toBe(345_450);
    expect(byDate.get("2026-10-30")?.p50Cents).toBe(495_450);
    expect(byDate.get("2026-11-01")?.p50Cents).toBe(375_450);

    const end = result.forecast[result.forecast.length - 1];

    expect([end.p10Cents, end.p50Cents, end.p90Cents]).toEqual([375_450, 375_450, 375_450]);
    expect(result.safety.safetyProbability).toBe(1);
    // The lowest point is today's $2,000, so $1,700 is above the $300 minimum.
    expect(result.safeToSpend).toMatchObject({
      amountCents: 170_000,
      status: "meets_target",
      limitedBy: "available_balance",
    });
    expect(result.risk.minimumBalanceP5Cents).toBe(200_000);
  });

  it("agrees with the path minima used by the optimizer", () => {
    const input = makeInput(typicalDataset);
    const paths = simulatePaths(input);
    const minima = postOpeningMinimum(paths);

    expect(minima.every((value) => value <= input.openingBalanceCents)).toBe(true);
  });
});
