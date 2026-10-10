import { describe, expect, it } from "vitest";

import { PRIMARY_ACCOUNT_ID } from "@/data/mock-accounts";
import { demoDataset } from "@/data/demo-profile";
import { FALLBACK_VOLATILITY } from "@/lib/constants";
import { makeProfile } from "@/lib/profile/__tests__/fixtures";
import { PERSONAL_ACCOUNT_ID, profileToDataset } from "@/lib/profile/timeline";
import {
  buildSimulationConfig,
  isSimulationResultCurrent,
  type SimulationConfigOptions,
  type SimulationResult,
} from "@/services/simulation";

function personalOptions(
  overrides: Partial<SimulationConfigOptions> = {},
): SimulationConfigOptions {
  return {
    dataset: profileToDataset(makeProfile()),
    accountId: PERSONAL_ACCOUNT_ID,
    protectedMinimumBalance: 300,
    targetConfidence: 0.95,
    horizonDays: 90,
    emergenciesEnabled: false,
    ...overrides,
  };
}

function resultFor(fingerprint: string): SimulationResult {
  return {
    configFingerprint: fingerprint,
    completedAt: "2026-10-12T15:00:00.000Z",
    probabilityAboveMinimum: 0.97,
    iterations: 10_000,
  };
}

describe("stale simulation results", () => {
  const original = buildSimulationConfig(personalOptions());
  const result = resultFor(original.fingerprint);

  it("accepts a result computed from the current inputs", () => {
    expect(isSimulationResultCurrent(result, buildSimulationConfig(personalOptions()))).toBe(true);
  });

  it("rejects it once an onboarding answer changes", () => {
    const edited = profileToDataset(
      makeProfile({ housing: { amountCents: 140_000, dueDay: 1 } }),
    );

    expect(
      isSimulationResultCurrent(result, buildSimulationConfig(personalOptions({ dataset: edited }))),
    ).toBe(false);
  });

  it.each([
    ["protected minimum", { protectedMinimumBalance: 500 }],
    ["caution level", { targetConfidence: 0.99 }],
    ["horizon", { horizonDays: 30 as const }],
    ["unexpected expenses", { emergenciesEnabled: true }],
  ])("rejects it once the %s changes", (_, change) => {
    expect(
      isSimulationResultCurrent(result, buildSimulationConfig(personalOptions(change))),
    ).toBe(false);
  });

  it("has nothing to show when there is no result", () => {
    expect(isSimulationResultCurrent(null, original)).toBe(false);
  });
});

describe("simulation inputs", () => {
  it("uses the disclosed fallback assumptions when there is no transaction history", () => {
    expect(buildSimulationConfig(personalOptions()).volatility).toEqual({
      kind: "fallback_assumptions",
      ...FALLBACK_VOLATILITY,
    });
  });

  it("uses the transaction history when the dataset has one", () => {
    const config = buildSimulationConfig(
      personalOptions({ dataset: demoDataset, accountId: PRIMARY_ACCOUNT_ID }),
    );

    expect(config.volatility.kind).toBe("transaction_history");
  });

  it("feeds the engine the same events the forecast uses", () => {
    const config = buildSimulationConfig(personalOptions({ horizonDays: 30 }));

    expect(config.startingBalance).toBe(2000);
    expect(config.events.map(({ date, name }) => `${date} ${name}`)).toEqual([
      "2026-10-16 Paycheck",
      "2026-10-30 Paycheck",
      "2026-11-01 Rent or mortgage",
    ]);
  });

  it("never carries a safety probability of its own", () => {
    const config = buildSimulationConfig(personalOptions());

    expect(config).not.toHaveProperty("probabilityAboveMinimum");
    expect(Object.keys(config).filter((key) => /probabilit/i.test(key))).toEqual([]);
  });
});
