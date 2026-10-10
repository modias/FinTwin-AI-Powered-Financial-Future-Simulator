"use client";

import { useMemo } from "react";

import { useActiveWorkspace } from "@/components/providers/workspace-provider";
import { buildSimulationConfig, type SimulationConfig } from "@/services/simulation";

/**
 * The input the Phase 2 simulation would receive right now. Its fingerprint
 * changes whenever a profile answer, preference or the selected account does.
 */
export function useSimulationConfig(): SimulationConfig {
  const { dataset, selectedAccountId, preferences, activeProfile } = useActiveWorkspace();

  return useMemo(
    () =>
      buildSimulationConfig({
        dataset,
        accountId: selectedAccountId,
        protectedMinimumBalance: preferences.minimumProtectedBalance,
        targetConfidence: preferences.targetConfidence / 100,
        horizonDays: preferences.forecastHorizonDays,
        emergenciesEnabled: activeProfile.emergencies.enabled,
      }),
    [dataset, selectedAccountId, preferences, activeProfile],
  );
}
