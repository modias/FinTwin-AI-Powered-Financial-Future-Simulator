"use client";

/**
 * TanStack Query bindings over the simulation worker.
 *
 * Every query is keyed by the input's fingerprint, which covers the dataset
 * (every profile answer), the account, the protected minimum, the target,
 * the horizon and the unexpected-expense setting. Any change is a new key,
 * so a new simulation; a result is only ever shown next to the inputs it was
 * computed from. There is deliberately no placeholder data: while a new
 * result is computed the screen shows that it is recalculating rather than
 * an old answer to a different question.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { fingerprint } from "@/lib/fingerprint";
import { getSimulationService } from "@/services/simulation-service";
import { buildSimulationInput } from "@/simulation/timeline";
import type {
  FinancialScenario,
  ScenarioComparison,
  SimulationInput,
  SimulationResult,
} from "@/simulation/types";

export const simulationKeys = {
  all: ["simulation"] as const,
  run: (inputFingerprint: string) => [...simulationKeys.all, "run", inputFingerprint] as const,
  compare: (inputFingerprint: string, scenariosKey: string) =>
    [...simulationKeys.all, "compare", inputFingerprint, scenariosKey] as const,
};

/** What the simulation would receive right now, from the active profile and preferences. */
export function useSimulationInput(): SimulationInput {
  const { dataset, selectedAccountId, preferences, activeProfile } = useActiveWorkspace();
  const emergenciesEnabled = activeProfile.emergencies.enabled;
  const { minimumProtectedBalance, targetConfidence, forecastHorizonDays } = preferences;

  return useMemo(
    () =>
      buildSimulationInput({
        dataset,
        accountId: selectedAccountId,
        protectedMinimumCents: Math.round(minimumProtectedBalance * 100),
        targetConfidence: targetConfidence / 100,
        horizonDays: forecastHorizonDays,
        emergenciesEnabled,
      }),
    [
      dataset,
      selectedAccountId,
      minimumProtectedBalance,
      targetConfidence,
      forecastHorizonDays,
      emergenciesEnabled,
    ],
  );
}

export interface SimulationState<T> {
  input: SimulationInput;
  /** Present only when computed from exactly `input`. */
  data: T | undefined;
  isPending: boolean;
  error: Error | null;
  retry: () => void;
}

export function useSimulation(): SimulationState<SimulationResult> {
  const input = useSimulationInput();
  const query = useQuery({
    queryKey: simulationKeys.run(input.fingerprint),
    queryFn: ({ signal }) => getSimulationService().run(input, signal),
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: false,
  });
  const data = query.data?.inputFingerprint === input.fingerprint ? query.data : undefined;

  return {
    input,
    data,
    isPending: data === undefined && !query.isError,
    error: query.error,
    retry: () => void query.refetch(),
  };
}

/**
 * The baseline and each scenario, evaluated on the same simulated paths.
 * Disabled (no data, not pending) while `scenarios` is empty.
 */
export function useScenarioComparison(
  scenarios: FinancialScenario[],
): SimulationState<ScenarioComparison> & { enabled: boolean } {
  const input = useSimulationInput();
  const scenariosKey = fingerprint(scenarios);
  const enabled = scenarios.length > 0;
  const query = useQuery({
    queryKey: simulationKeys.compare(input.fingerprint, scenariosKey),
    queryFn: ({ signal }) => getSimulationService().compare(input, scenarios, signal),
    enabled,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: false,
  });
  const data =
    enabled && query.data?.inputFingerprint === input.fingerprint ? query.data : undefined;

  return {
    input,
    data,
    enabled,
    isPending: enabled && data === undefined && !query.isError,
    error: enabled ? query.error : null,
    retry: () => void query.refetch(),
  };
}
